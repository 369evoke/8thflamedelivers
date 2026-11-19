"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient, createUserClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/quote-service";
import { recordEvent } from "@/lib/shipment-service";
import { normalizePostal, PROVINCES } from "@/lib/validation";
import { generateTicketNumber } from "@/lib/identifiers";
import { getStripe } from "@/lib/stripe";
import { audit } from "@/lib/audit";
import { notifyStaff } from "@/lib/notify";
import { integrations } from "@/lib/env";
import type { FormState } from "./auth";

const provinceCodes = PROVINCES.map((p) => p[0]) as [string, ...string[]];

export async function saveAddressAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { error: "Please sign in." };
  const parsed = z
    .object({
      label: z.string().trim().max(60).optional(),
      contact_name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(30).optional(),
      email: z.string().trim().email().optional().or(z.literal("")),
      street: z.string().trim().min(3).max(200),
      unit: z.string().trim().max(30).optional(),
      city: z.string().trim().min(2).max(80),
      province: z.enum(provinceCodes),
      postal_code: z.string().transform(normalizePostal).refine((v) => /^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(v), "Invalid postal code"),
      instructions: z.string().trim().max(500).optional(),
      business_id: z.string().uuid().optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join(" · ") };
  const { business_id, ...rest } = parsed.data;
  if (business_id && !user.businesses.some((b) => b.id === business_id)) return { error: "Not permitted." };
  // RLS-enforced insert with the user's own session
  const supabase = await createUserClient();
  const { error } = await supabase.from("addresses").insert({ ...rest, email: rest.email || null, profile_id: business_id ? null : user.id, business_id: business_id || null });
  if (error) return { error: "Couldn't save the address." };
  revalidatePath("/account/addresses");
  revalidatePath("/business/portal/addresses");
  return { success: "Address saved." };
}

export async function deleteAddressAction(fd: FormData) {
  const supabase = await createUserClient();
  await supabase.from("addresses").delete().eq("id", String(fd.get("id"))); // RLS restricts to owner
  revalidatePath("/account/addresses");
  revalidatePath("/business/portal/addresses");
}

export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { error: "Please sign in." };
  const p = z.object({ full_name: z.string().trim().min(2).max(120), phone: z.string().trim().max(30).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Please enter your name." };
  const supabase = await createUserClient();
  const { error } = await supabase.from("profiles").update(p.data).eq("id", user.id);
  if (error) return { error: "Couldn't update your profile." };
  revalidatePath("/account/settings");
  return { success: "Profile updated." };
}

/** Customer self-cancel: allowed only in statuses permitted by company policy. Refunds automatically if paid by card. */
export async function cancelShipmentAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { error: "Please sign in." };
  const id = String(fd.get("id"));
  const admin = createAdminClient();
  const { data: s } = await admin.from("shipments").select("id, status, customer_profile_id, business_id, tracking_number, payment_status").eq("id", id).single();
  const owns = s && (s.customer_profile_id === user.id || (s.business_id && user.businesses.some((b) => b.id === s.business_id && ["owner", "admin"].includes(b.member_role))));
  if (!s || !owns) return { error: "Shipment not found." };

  const { cancellable } = await loadSettings();
  if (!cancellable.includes(s.status)) return { error: "This shipment can no longer be cancelled online. Please contact support." };
  const { count } = await admin.from("shipment_assignments").select("id", { count: "exact", head: true }).eq("shipment_id", id).eq("is_active", true);
  if ((count ?? 0) > 0) return { error: "A driver is already assigned. Please contact support to cancel." };

  await recordEvent(id, "cancelled", { actor: user, notes: "Cancelled by customer.", skipTransitionCheck: true });
  await admin.from("shipments").update({ cancel_reason: "Customer cancelled online" }).eq("id", id);

  let msg = "Shipment cancelled.";
  if (s.payment_status === "paid" && integrations.stripe()) {
    const { data: pay } = await admin.from("payments").select("id, stripe_payment_intent_id, amount_cents").eq("shipment_id", id).eq("status", "paid").maybeSingle();
    if (pay?.stripe_payment_intent_id) {
      try {
        const r = await getStripe().refunds.create({ payment_intent: pay.stripe_payment_intent_id, reason: "requested_by_customer" }, { idempotencyKey: `cancel-${id}` });
        await admin.from("refunds").insert({ payment_id: pay.id, amount_cents: pay.amount_cents, reason: "Customer cancellation", stripe_refund_id: r.id, status: r.status === "succeeded" ? "succeeded" : "pending", processed_by: user.id });
        msg = "Shipment cancelled. A full refund has been issued to your card.";
      } catch {
        await notifyStaff("staff.refund_failed", `Refund needed for ${s.tracking_number}`, ["Automatic refund failed after customer cancellation."]);
        msg = "Shipment cancelled. Our team will process your refund shortly.";
      }
    }
  }
  await audit(user, "shipment.cancel", "shipment", id, {});
  revalidatePath(`/account/shipments/${id}`);
  return { success: msg };
}

export async function createTicketAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { error: "Please sign in." };
  const p = z
    .object({
      category: z.enum(["missing_shipment", "delayed_shipment", "billing", "damage", "general", "business", "driver"]),
      subject: z.string().trim().min(3).max(200),
      message: z.string().trim().min(5).max(5000),
      shipment_id: z.string().uuid().optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Please add a subject and message." };
  const admin = createAdminClient();
  let shipment_id: string | null = null;
  if (p.data.shipment_id) {
    const { data } = await createUserClient().then((c) => c.from("shipments").select("id").eq("id", p.data.shipment_id!).maybeSingle());
    shipment_id = data?.id ?? null; // RLS confirms access
  }
  const num = generateTicketNumber();
  const { data: t } = await admin
    .from("support_tickets")
    .insert({ ticket_number: num, profile_id: user.id, contact_email: user.email, contact_name: user.fullName, shipment_id, category: p.data.category, subject: p.data.subject, priority: ["missing_shipment", "damage"].includes(p.data.category) ? "high" : "normal" })
    .select("id")
    .single();
  if (!t) return { error: "Couldn't create the ticket." };
  await admin.from("support_messages").insert({ ticket_id: t.id, author_profile_id: user.id, author_label: user.fullName ?? user.email, body: p.data.message });
  await notifyStaff("staff.support", `Support request ${num}`, [p.data.subject], `/admin/support/${t.id}`);
  revalidatePath("/account/support");
  return { success: `Ticket ${num} created.` };
}

export async function replyTicketAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { error: "Please sign in." };
  const id = String(fd.get("ticket_id"));
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 1) return { error: "Write a message." };
  const admin = createAdminClient();
  const { data: t } = await admin.from("support_tickets").select("id, profile_id, status").eq("id", id).single();
  if (!t || t.profile_id !== user.id) return { error: "Ticket not found." };
  if (t.status === "closed") return { error: "This ticket is closed. Please open a new one." };
  await admin.from("support_messages").insert({ ticket_id: id, author_profile_id: user.id, author_label: user.fullName ?? user.email, body: body.slice(0, 5000) });
  await admin.from("support_tickets").update({ status: "open" }).eq("id", id);
  revalidatePath(`/account/support/${id}`);
  return { success: "Reply sent." };
}

export async function markNotificationsReadAction() {
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createUserClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("profile_id", user.id).is("read_at", null);
  revalidatePath("/account/notifications");
}
