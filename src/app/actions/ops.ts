"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { BookingError, recordEvent } from "@/lib/shipment-service";
import { canTransition, isShipmentStatus } from "@/lib/status";
import { notify } from "@/lib/notify";
import { getStripe } from "@/lib/stripe";
import { audit } from "@/lib/audit";
import { env, integrations } from "@/lib/env";
import type { FormState } from "./auth";

function fail(e: unknown): FormState {
  if (e instanceof AuthError || e instanceof BookingError) return { error: e.message };
  console.error(e);
  return { error: (e as Error).message || "Something went wrong." };
}
const refresh = (id?: string) => {
  revalidatePath("/dispatch");
  revalidatePath("/admin/shipments");
  if (id) revalidatePath(`/admin/shipments/${id}`);
};

export async function confirmShipmentAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("shipments.confirm");
    const id = String(fd.get("id"));
    const { data: s } = await createAdminClient().from("shipments").select("payment_status").eq("id", id).single();
    if (!["paid", "invoiced"].includes(s?.payment_status)) return { error: "Only paid or invoiced shipments can be confirmed." };
    await recordEvent(id, "confirmed", { actor: u, notes: "Booking confirmed by operations." });
    await audit(u, "shipment.confirm", "shipment", id);
    refresh(id);
    return { success: "Shipment confirmed." };
  } catch (e) { return fail(e); }
}

export async function schedulePickupAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("dispatch.assign");
    const p = z.object({ id: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/), notes: z.string().max(500).optional() }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: "Enter a date and time window." };
    if (p.data.end <= p.data.start) return { error: "End time must be after start time." };
    await createAdminClient().from("pickup_schedules").upsert({ shipment_id: p.data.id, scheduled_date: p.data.date, window_start: p.data.start, window_end: p.data.end, scheduled_by: u.id, notes: p.data.notes || null }, { onConflict: "shipment_id" });
    const { data: s } = await createAdminClient().from("shipments").select("status").eq("id", p.data.id).single();
    if (canTransition(s!.status, "pickup_scheduled")) await recordEvent(p.data.id, "pickup_scheduled", { actor: u, notes: `Pickup scheduled for ${p.data.date}, ${p.data.start}–${p.data.end}.` });
    await audit(u, "shipment.schedule_pickup", "shipment", p.data.id, p.data);
    refresh(p.data.id);
    return { success: "Pickup scheduled." };
  } catch (e) { return fail(e); }
}

/** Assigns (or reassigns) an approved, active driver. Deactivates any previous active assignment of the same type. */
export async function assignDriverAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("dispatch.assign");
    const id = String(fd.get("id"));
    const driverId = String(fd.get("driver_id"));
    const type = (String(fd.get("assignment_type") || "full") as "full" | "pickup" | "delivery");
    const admin = createAdminClient();
    const { data: d } = await admin.from("drivers").select("id, status, profile_id, profiles(email, full_name, is_active)").eq("id", driverId).single();
    const prof = d?.profiles as unknown as { email: string; full_name: string; is_active: boolean } | null;
    if (!d || d.status !== "approved" || !prof?.is_active) return { error: "Choose an approved, active driver." };
    const { data: s } = await admin.from("shipments").select("status, tracking_number, payment_status").eq("id", id).single();
    if (!s || !["paid", "invoiced"].includes(s.payment_status)) return { error: "Shipment must be paid or invoiced before assignment." };
    if (["shipment_created", "awaiting_confirmation"].includes(s.status)) return { error: "Confirm the shipment first." };

    const { data: prev } = await admin.from("shipment_assignments").select("id, driver_id").eq("shipment_id", id).eq("assignment_type", type).eq("is_active", true).maybeSingle();
    if (prev?.driver_id === driverId) return { error: "That driver is already assigned." };
    if (prev) {
      await admin.from("shipment_assignments").update({ is_active: false }).eq("id", prev.id);
      const { data: old } = await admin.from("drivers").select("profile_id, profiles(email)").eq("id", prev.driver_id).single();
      await notify({ audience: "driver", template: "driver.assignment_removed", to: (old?.profiles as unknown as { email: string })?.email, profileId: old?.profile_id, shipmentId: id, subject: `Assignment changed: ${s.tracking_number}`, heading: "Assignment updated", paragraphs: [`Shipment ${s.tracking_number} has been reassigned and removed from your list.`] });
    }
    await admin.from("shipment_assignments").insert({ shipment_id: id, driver_id: driverId, assignment_type: type, assigned_by: u.id, notes: String(fd.get("notes") ?? "") || null });

    if (canTransition(s.status, "driver_assigned")) await recordEvent(id, "driver_assigned", { actor: u, notes: "A driver has been assigned." });
    else await recordEvent(id, s.status, { actor: u, notes: null, internalNotes: `Reassigned to ${prof.full_name}`, isPublic: false, skipTransitionCheck: true, silent: true });

    await notify({ audience: "driver", template: prev ? "driver.assignment_updated" : "driver.new_assignment", to: prof.email, profileId: d.profile_id, shipmentId: id, subject: `New assignment: ${s.tracking_number}`, heading: "New shipment assignment", paragraphs: [`You've been assigned shipment ${s.tracking_number}.`], cta: { label: "Open in driver app", url: `${env.siteUrl}/driver/shipments/${id}` } });
    await audit(u, prev ? "shipment.reassign" : "shipment.assign", "shipment", id, { driverId, type });
    refresh(id);
    return { success: prev ? "Shipment reassigned." : "Driver assigned." };
  } catch (e) { return fail(e); }
}

export async function staffStatusAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("shipments.update_status");
    const id = String(fd.get("id"));
    const status = String(fd.get("status"));
    if (!isShipmentStatus(status)) return { error: "Choose a status." };
    if (status === "cancelled") return { error: "Use Cancel shipment instead." };
    const notes = String(fd.get("notes") ?? "").trim() || null;
    await recordEvent(id, status, { actor: u, location: String(fd.get("location") ?? "") || null, notes: fd.get("public") === "on" ? notes : null, internalNotes: fd.get("public") === "on" ? null : notes });
    await audit(u, "shipment.status", "shipment", id, { status });
    refresh(id);
    return { success: "Status updated." };
  } catch (e) { return fail(e); }
}

export async function internalNoteAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("shipments.notes");
    const id = String(fd.get("id"));
    const note = String(fd.get("note") ?? "").trim().slice(0, 2000);
    if (!note) return { error: "Write a note." };
    const admin = createAdminClient();
    const { data: s } = await admin.from("shipments").select("internal_notes").eq("id", id).single();
    const stamp = `[${new Date().toLocaleString("en-CA")} — ${u.fullName ?? u.email}] ${note}`;
    await admin.from("shipments").update({ internal_notes: s?.internal_notes ? `${s.internal_notes}\n${stamp}` : stamp }).eq("id", id);
    await audit(u, "shipment.note", "shipment", id);
    refresh(id);
    return { success: "Note added." };
  } catch (e) { return fail(e); }
}

export async function staffCancelAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("shipments.cancel");
    const id = String(fd.get("id"));
    const reason = String(fd.get("reason") ?? "").trim();
    if (reason.length < 3) return { error: "Enter a cancellation reason." };
    const admin = createAdminClient();
    const { data: s } = await admin.from("shipments").select("status").eq("id", id).single();
    if (["delivered", "cancelled", "returned_to_sender"].includes(s!.status)) return { error: "This shipment can't be cancelled." };
    await recordEvent(id, "cancelled", { actor: u, notes: "Shipment cancelled.", internalNotes: reason, skipTransitionCheck: true });
    await admin.from("shipments").update({ cancel_reason: reason }).eq("id", id);
    await admin.from("shipment_assignments").update({ is_active: false }).eq("shipment_id", id);
    await audit(u, "shipment.cancel", "shipment", id, { reason });
    refresh(id);
    return { success: "Shipment cancelled. Issue a refund separately if eligible." };
  } catch (e) { return fail(e); }
}

export async function refundAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("payments.refund");
    if (!integrations.stripe()) return { error: "Stripe is not configured." };
    const paymentId = String(fd.get("payment_id"));
    const amount = Math.round(Number(fd.get("amount")) * 100);
    const reason = String(fd.get("reason") ?? "").trim();
    if (!reason) return { error: "Enter a reason." };
    const admin = createAdminClient();
    const { data: p } = await admin.from("payments").select("*").eq("id", paymentId).single();
    if (!p || !["paid", "partially_refunded"].includes(p.status) || !p.stripe_payment_intent_id) return { error: "Payment isn't refundable." };
    const { data: prior } = await admin.from("refunds").select("amount_cents").eq("payment_id", paymentId).neq("status", "failed");
    const refunded = (prior ?? []).reduce((s, r) => s + r.amount_cents, 0);
    if (!(amount > 0) || amount > p.amount_cents - refunded) return { error: `Refund must be between $0.01 and ${((p.amount_cents - refunded) / 100).toFixed(2)}.` };

    const r = await getStripe().refunds.create({ payment_intent: p.stripe_payment_intent_id, amount }, { idempotencyKey: `refund-${paymentId}-${refunded}-${amount}` });
    await admin.from("refunds").insert({ payment_id: paymentId, amount_cents: amount, reason, stripe_refund_id: r.id, status: r.status === "succeeded" ? "succeeded" : "pending", processed_by: u.id });
    await audit(u, "payment.refund", "payment", paymentId, { amount, reason });
    refresh(p.shipment_id);
    revalidatePath("/admin/payments");
    return { success: "Refund submitted to Stripe. Status updates when Stripe confirms." };
  } catch (e) { return fail(e); }
}

export async function createRouteAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("dispatch.routes");
    const p = z.object({ name: z.string().trim().min(2).max(120), route_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), driver_id: z.string().uuid().optional().or(z.literal("")), area_id: z.string().uuid().optional().or(z.literal("")), notes: z.string().max(500).optional() }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: "Enter a route name and date." };
    const { data, error } = await createAdminClient().from("delivery_routes").insert({ ...p.data, driver_id: p.data.driver_id || null, area_id: p.data.area_id || null, created_by: u.id }).select("id").single();
    if (error) return { error: error.message };
    await audit(u, "route.create", "route", data.id, p.data);
    revalidatePath("/dispatch/routes");
    return { success: "Route created." };
  } catch (e) { return fail(e); }
}

/** Adds selected shipments to a route and assigns the route's driver to each one. */
export async function addStopsAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("dispatch.routes");
    const routeId = String(fd.get("route_id"));
    const ids = fd.getAll("shipment_ids").map(String).filter(Boolean);
    const stopType = String(fd.get("stop_type")) === "pickup" ? "pickup" : "delivery";
    if (!ids.length) return { error: "Select at least one shipment." };
    const admin = createAdminClient();
    const { data: route } = await admin.from("delivery_routes").select("id, driver_id, name").eq("id", routeId).single();
    if (!route) return { error: "Route not found." };
    const { data: existing } = await admin.from("route_stops").select("sequence").eq("route_id", routeId).order("sequence", { ascending: false }).limit(1);
    let seq = existing?.[0]?.sequence ?? 0;
    for (const sid of ids) {
      seq++;
      await admin.from("route_stops").upsert({ route_id: routeId, shipment_id: sid, stop_type: stopType, sequence: seq }, { onConflict: "route_id,shipment_id,stop_type" });
      if (route.driver_id) {
        const f = new FormData();
        f.set("id", sid); f.set("driver_id", route.driver_id); f.set("assignment_type", "full");
        const r = await assignDriverAction({}, f);
        if (r.success) await admin.from("shipment_assignments").update({ route_id: routeId }).eq("shipment_id", sid).eq("is_active", true);
      }
    }
    await audit(u, "route.add_stops", "route", routeId, { ids, stopType });
    revalidatePath(`/dispatch/routes/${routeId}`);
    return { success: `${ids.length} stop(s) added${route.driver_id ? " and assigned to the route driver" : ""}.` };
  } catch (e) { return fail(e); }
}

export async function reorderStopAction(fd: FormData) {
  await assertPermission("dispatch.routes");
  const admin = createAdminClient();
  const routeId = String(fd.get("route_id"));
  const stopId = String(fd.get("stop_id"));
  const dir = String(fd.get("dir")) === "up" ? -1 : 1;
  const { data: stops } = await admin.from("route_stops").select("id, sequence").eq("route_id", routeId).order("sequence");
  if (!stops) return;
  const i = stops.findIndex((s) => s.id === stopId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= stops.length) return;
  // two-step swap to avoid transient duplicates
  await admin.from("route_stops").update({ sequence: 10000 + i }).eq("id", stops[i].id);
  await admin.from("route_stops").update({ sequence: stops[i].sequence }).eq("id", stops[j].id);
  await admin.from("route_stops").update({ sequence: stops[j].sequence }).eq("id", stops[i].id);
  revalidatePath(`/dispatch/routes/${routeId}`);
}

export async function removeStopAction(fd: FormData) {
  await assertPermission("dispatch.routes");
  const routeId = String(fd.get("route_id"));
  await createAdminClient().from("route_stops").delete().eq("id", String(fd.get("stop_id"))).eq("route_id", routeId);
  revalidatePath(`/dispatch/routes/${routeId}`);
}

export async function routeStatusAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("dispatch.routes");
    const id = String(fd.get("route_id"));
    const status = String(fd.get("status"));
    if (!["planned", "active", "completed", "cancelled"].includes(status)) return { error: "Invalid status." };
    const patch: Record<string, unknown> = { status };
    const driver = String(fd.get("driver_id") ?? "");
    if (driver) patch.driver_id = driver;
    await createAdminClient().from("delivery_routes").update(patch).eq("id", id);
    if (driver) {
      const { data: d } = await createAdminClient().from("drivers").select("profile_id, profiles(email)").eq("id", driver).single();
      await notify({ audience: "driver", template: "driver.route_change", to: (d?.profiles as unknown as { email: string })?.email, profileId: d?.profile_id, subject: "Your route has changed", heading: "Route update", paragraphs: ["A route assigned to you was updated. Open the driver app to see the latest stops."], cta: { label: "My routes", url: `${env.siteUrl}/driver/routes` } });
    }
    await audit(u, "route.update", "route", id, patch);
    revalidatePath(`/dispatch/routes/${id}`);
    return { success: "Route updated." };
  } catch (e) { return fail(e); }
}
