"use server";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { bookingSchema } from "@/lib/validation";
import { BookingError, createShipment } from "@/lib/shipment-service";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "./auth";

export interface BulkResult extends FormState {
  rows?: { row: number; ok: boolean; message: string; tracking?: string }[];
}

async function businessAdmin(businessId: string) {
  const u = await getSessionUser();
  const m = u?.businesses.find((b) => b.id === businessId && b.status === "approved");
  if (!u || !m) throw new Error("Not an authorized member of this business.");
  return { u, m, isAdmin: ["owner", "admin"].includes(m.member_role) };
}

const MAX_ROWS = 200;

export async function bulkUploadAction(_: BulkResult, fd: FormData): Promise<BulkResult> {
  try {
    const businessId = String(fd.get("business_id"));
    const { u } = await businessAdmin(businessId);
    if (!(await rateLimit("bulk", 5, 10 * 60_000)).ok) return { error: "Too many uploads. Please wait a few minutes." };
    const admin = createAdminClient();
    const { data: biz } = await admin.from("businesses").select("*").eq("id", businessId).single();
    if (!biz?.invoicing_enabled) return { error: "Bulk shipping requires invoice billing on your account. Contact 8th Flame to enable it, or create shipments individually." };

    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
    if (file.size > 2 * 1024 * 1024) return { error: "CSV must be under 2 MB." };

    const pickupId = String(fd.get("pickup_address_id") ?? "");
    const { data: pickup } = pickupId ? await admin.from("addresses").select("*").eq("id", pickupId).eq("business_id", businessId).maybeSingle() : { data: null };
    const sender = pickup
      ? { name: pickup.contact_name, phone: pickup.phone ?? biz.phone, email: pickup.email ?? biz.email, street: pickup.street, unit: pickup.unit ?? "", city: pickup.city, province: pickup.province, postal: pickup.postal_code, instructions: pickup.instructions ?? "" }
      : null;
    if (!sender) return { error: "Choose a saved pickup address (add one under Saved Addresses)." };

    const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
    if (parsed.errors.length && !parsed.data.length) return { error: "Couldn't read that CSV." };
    if (parsed.data.length > MAX_ROWS) return { error: `Upload at most ${MAX_ROWS} rows at a time.` };

    const rows: NonNullable<BulkResult["rows"]> = [];
    for (let i = 0; i < parsed.data.length; i++) {
      const r = parsed.data[i];
      const input = bookingSchema.safeParse({
        sender,
        recipient: { name: r.recipient_name, phone: r.recipient_phone, email: r.recipient_email ?? "", street: r.street, unit: r.unit ?? "", city: r.city, province: (r.province ?? "").toUpperCase(), postal: r.postal_code, instructions: r.instructions ?? "" },
        pickup_date: r.pickup_date || String(fd.get("pickup_date")),
        pickup_window: r.pickup_window || String(fd.get("pickup_window")),
        packages: [{ package_type: r.package_type || "Small box", description: r.description, quantity: r.quantity || 1, weight_kg: r.weight_kg, length_cm: r.length_cm, width_cm: r.width_cm, height_cm: r.height_cm, special_handling: (r.special_handling ?? "").split(/[;|]/).map((x) => x.trim()).filter(Boolean) }],
        service_code: r.service_code || "business",
        business_id: businessId,
        billing_method: "invoice",
        restricted_items_ack: fd.get("ack") === "on",
      });
      if (!input.success) {
        rows.push({ row: i + 2, ok: false, message: input.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).slice(0, 3).join("; ") });
        continue;
      }
      try {
        const s = await createShipment(input.data, u);
        rows.push({ row: i + 2, ok: true, message: "Created", tracking: s.tracking_number });
      } catch (e) {
        rows.push({ row: i + 2, ok: false, message: e instanceof BookingError ? [e.message, ...e.details].join(" ") : "Unexpected error" });
      }
    }
    const ok = rows.filter((r) => r.ok).length;
    await audit(u, "business.bulk_upload", "business", businessId, { rows: rows.length, created: ok });
    revalidatePath("/business/portal/shipments");
    return { success: `${ok} of ${rows.length} shipments created.`, rows };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function addMemberAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const businessId = String(fd.get("business_id"));
    const { u, isAdmin } = await businessAdmin(businessId);
    if (!isAdmin) return { error: "Only owners and admins can manage team members." };
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const role = String(fd.get("member_role")) === "admin" ? "admin" : "member";
    const admin = createAdminClient();
    const { data: p } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (!p) return { error: "No 8th Flame account uses that email. Ask them to sign up first, then add them." };
    const { error } = await admin.from("business_members").insert({ business_id: businessId, profile_id: p.id, member_role: role });
    if (error) return { error: error.code === "23505" ? "Already a team member." : error.message };
    await audit(u, "business.member_add", "business", businessId, { email, role });
    revalidatePath("/business/portal/team");
    return { success: "Team member added." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function removeMemberAction(fd: FormData) {
  const businessId = String(fd.get("business_id"));
  const { u, isAdmin } = await businessAdmin(businessId);
  if (!isAdmin) return;
  const id = String(fd.get("member_id"));
  const admin = createAdminClient();
  const { data: m } = await admin.from("business_members").select("member_role, profile_id").eq("id", id).eq("business_id", businessId).single();
  if (!m || m.member_role === "owner" || m.profile_id === u.id) return;
  await admin.from("business_members").delete().eq("id", id);
  await audit(u, "business.member_remove", "business", businessId, { member: id });
  revalidatePath("/business/portal/team");
}
