"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, AuthError, type SessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { env } from "@/lib/env";
import { assignableRoles, type Role } from "@/lib/permissions";
import { generateInvoiceNumber } from "@/lib/identifiers";
import { formatCents } from "@/lib/pricing";
import type { FormState } from "./auth";

function fail(e: unknown): FormState {
  if (e instanceof AuthError) return { error: e.message };
  console.error(e);
  return { error: (e as Error).message || "Something went wrong." };
}
const cents = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Math.round(Number(v) * 100));
const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));
const list = (v: FormDataEntryValue | null) => String(v ?? "").split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

/** Finds a profile by email or invites a new auth user (who sets their password from the email). */
async function ensureProfile(email: string, fullName: string, phone?: string | null) {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName, phone }, redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password` });
  if (error || !data.user) throw new Error(`Couldn't invite ${email}: ${error?.message}`);
  return data.user.id;
}

// ───────────── Drivers ─────────────
export async function reviewDriverApplicationAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("drivers.applications");
    const id = String(fd.get("id"));
    const decision = String(fd.get("decision")) as "under_review" | "approved" | "rejected";
    if (!["under_review", "approved", "rejected"].includes(decision)) return { error: "Choose a decision." };
    const notes = String(fd.get("notes") ?? "").slice(0, 2000) || null;
    const admin = createAdminClient();
    const { data: app } = await admin.from("driver_applications").select("*").eq("id", id).single();
    if (!app) return { error: "Application not found." };

    if (decision === "approved") {
      const profileId = app.profile_id ?? (await ensureProfile(app.email, app.full_name, app.phone));
      await admin.from("profiles").update({ role: "driver", full_name: app.full_name, phone: app.phone }).eq("id", profileId);
      await admin.from("drivers").upsert({ profile_id: profileId, application_id: id, status: "approved", vehicle_type: app.vehicle_type, vehicle_info: app.vehicle_info, home_area_id: String(fd.get("home_area_id") || "") || null }, { onConflict: "profile_id" });
      await admin.from("driver_applications").update({ profile_id: profileId }).eq("id", id);
    }
    await admin.from("driver_applications").update({ status: decision, reviewer_id: u.id, reviewer_notes: notes, reviewed_at: new Date().toISOString() }).eq("id", id);

    if (decision !== "under_review") {
      await notify({
        audience: "driver", template: `driver.application_${decision}`, to: app.email, profileId: app.profile_id,
        subject: decision === "approved" ? "Welcome to the 8th Flame Delivery team" : "Your driver application",
        heading: decision === "approved" ? "You're approved" : "Application update",
        paragraphs: decision === "approved"
          ? ["Your driver application has been approved. Sign in to the driver portal to set your availability. If this is your first sign-in, use the invitation email to set your password."]
          : ["Thank you for your interest in driving with 8th Flame Delivery. After review, we're unable to move forward with your application at this time."],
        cta: decision === "approved" ? { label: "Open driver portal", url: `${env.siteUrl}/driver` } : undefined,
      });
    }
    await audit(u, `driver_application.${decision}`, "driver_application", id, { notes });
    revalidatePath("/admin/driver-applications");
    return { success: `Application marked ${decision.replace("_", " ")}.` };
  } catch (e) { return fail(e); }
}

export async function setDriverStatusAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("drivers.manage");
    const id = String(fd.get("id"));
    const status = String(fd.get("status"));
    if (!["approved", "suspended"].includes(status)) return { error: "Invalid status." };
    const admin = createAdminClient();
    const patch: Record<string, unknown> = { status };
    if (fd.has("home_area_id")) patch.home_area_id = String(fd.get("home_area_id")) || null;
    await admin.from("drivers").update(patch).eq("id", id);
    let note = "";
    if (status === "suspended") {
      const { count } = await admin.from("shipment_assignments").update({ is_active: false }, { count: "exact" }).eq("driver_id", id).eq("is_active", true);
      await admin.from("drivers").update({ is_available: false }).eq("id", id);
      if (count) note = ` ${count} active assignment(s) were removed — reassign them on the dispatch board.`;
    }
    await audit(u, `driver.${status}`, "driver", id, patch);
    revalidatePath("/admin/drivers");
    return { success: `Driver ${status}.${note}` };
  } catch (e) { return fail(e); }
}

export async function documentLinkAction(path: string) {
  await assertPermission("drivers.applications");
  const { data } = await createAdminClient().storage.from("driver-documents").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

// ───────────── Businesses ─────────────
export async function reviewBusinessAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("businesses.manage");
    const id = String(fd.get("id"));
    const p = z.object({
      status: z.enum(["submitted", "under_review", "approved", "rejected", "suspended"]),
      discount_percent: z.coerce.number().min(0).max(90),
      invoicing_enabled: z.string().optional(),
      payment_terms_days: z.coerce.number().int().min(0).max(120),
      reviewer_notes: z.string().max(2000).optional(),
    }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: "Check the values." };
    const admin = createAdminClient();
    const { data: before } = await admin.from("businesses").select("status, email, name, owner_profile_id").eq("id", id).single();
    const patch = { ...p.data, invoicing_enabled: p.data.invoicing_enabled === "on" };
    await admin.from("businesses").update(patch).eq("id", id);
    if (before && before.status !== p.data.status && ["approved", "rejected"].includes(p.data.status)) {
      await notify({
        audience: "business", template: `business.${p.data.status}`, to: before.email, profileId: before.owner_profile_id,
        subject: p.data.status === "approved" ? `${before.name} is approved for business shipping` : "Your business account application",
        heading: p.data.status === "approved" ? "Business account approved" : "Application update",
        paragraphs: p.data.status === "approved" ? ["Your business shipping account is active. Sign in to access the business portal."] : ["After review we're unable to approve this business account at this time. Reply to this email if you have questions."],
        cta: p.data.status === "approved" ? { label: "Open business portal", url: `${env.siteUrl}/business/portal` } : undefined,
      });
    }
    await audit(u, "business.update", "business", id, patch);
    revalidatePath("/admin/businesses");
    return { success: "Business account updated." };
  } catch (e) { return fail(e); }
}

// ───────────── Services, pricing, areas, promos ─────────────
export async function upsertServiceAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("services.manage");
    const row = {
      code: String(fd.get("code")).trim().toLowerCase(),
      name: String(fd.get("name")).trim(),
      description: String(fd.get("description") ?? "") || null,
      base_price_cents: cents(fd.get("base_price")) ?? 0,
      per_km_cents: cents(fd.get("per_km")) ?? 0,
      per_kg_cents: cents(fd.get("per_kg")) ?? 0,
      included_kg: num(fd.get("included_kg")) ?? 0,
      min_charge_cents: cents(fd.get("min_charge")) ?? 0,
      surcharge_cents: cents(fd.get("surcharge")) ?? 0,
      max_distance_km: num(fd.get("max_distance_km")),
      transit_days: num(fd.get("transit_days")) ?? 1,
      same_day: fd.get("same_day") === "on",
      business_only: fd.get("business_only") === "on",
      is_active: fd.get("is_active") === "on",
    };
    if (!/^[a-z_]+$/.test(row.code) || row.name.length < 2) return { error: "Code must be lowercase letters/underscores; name required." };
    if ([row.base_price_cents, row.per_km_cents, row.per_kg_cents, row.min_charge_cents, row.surcharge_cents].some((v) => !(v >= 0))) return { error: "Prices must be zero or more." };
    const { error } = await createAdminClient().from("shipping_services").upsert(row, { onConflict: "code" });
    if (error) return { error: error.message };
    await audit(u, "service.upsert", "shipping_service", row.code, row);
    revalidatePath("/admin/services");
    return { success: `Saved ${row.name}.` };
  } catch (e) { return fail(e); }
}

export async function upsertPricingRuleAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("pricing.manage");
    const rule_type = String(fd.get("rule_type"));
    if (!["tax", "handling_fee", "dim_divisor"].includes(rule_type)) return { error: "Invalid rule type." };
    const row = {
      rule_type,
      key: String(fd.get("key")).trim(),
      label: String(fd.get("label")).trim(),
      amount_cents: cents(fd.get("amount")),
      percent: num(fd.get("percent")),
      numeric_value: num(fd.get("numeric_value")),
      is_active: fd.get("is_active") !== "off",
    };
    if (!row.key || !row.label) return { error: "Key and label are required." };
    if (rule_type === "tax" && (row.percent == null || row.percent < 0 || row.percent > 30)) return { error: "Tax percent must be between 0 and 30." };
    if (rule_type === "dim_divisor" && !(Number(row.numeric_value) >= 1000)) return { error: "Dimensional divisor must be at least 1000." };
    const admin = createAdminClient();
    const id = String(fd.get("id") ?? "");
    const { error } = id ? await admin.from("pricing_rules").update(row).eq("id", id) : await admin.from("pricing_rules").insert(row);
    if (error) return { error: error.message };
    await audit(u, "pricing_rule.upsert", "pricing_rule", id || row.key, row);
    revalidatePath("/admin/pricing");
    return { success: "Pricing rule saved." };
  } catch (e) { return fail(e); }
}

export async function deletePricingRuleAction(fd: FormData) {
  const u = await assertPermission("pricing.manage");
  const id = String(fd.get("id"));
  await createAdminClient().from("pricing_rules").delete().eq("id", id);
  await audit(u, "pricing_rule.delete", "pricing_rule", id);
  revalidatePath("/admin/pricing");
}

export async function upsertAreaAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("areas.manage");
    const row = {
      name: String(fd.get("name")).trim(),
      city: String(fd.get("city")).trim(),
      province: String(fd.get("province")).trim().toUpperCase(),
      postal_prefixes: list(fd.get("postal_prefixes")).map((x) => x.toUpperCase().slice(0, 3)),
      zone: String(fd.get("zone") || "local"),
      center_lat: num(fd.get("center_lat")),
      center_lng: num(fd.get("center_lng")),
      service_codes: fd.getAll("service_codes").map(String),
      price_multiplier: num(fd.get("price_multiplier")) ?? 1,
      is_active: fd.get("is_active") === "on",
    };
    if (row.name.length < 2 || !/^[A-Z]{2}$/.test(row.province)) return { error: "Name and province are required." };
    if (row.postal_prefixes.some((p) => !/^[A-Z]\d[A-Z]$/.test(p))) return { error: "Postal prefixes must be 3-character FSAs like M5V." };
    if (row.is_active && !row.postal_prefixes.length) return { error: "Add postal prefixes before activating an area." };
    const admin = createAdminClient();
    const id = String(fd.get("id") ?? "");
    const { error } = id ? await admin.from("service_areas").update(row).eq("id", id) : await admin.from("service_areas").insert(row);
    if (error) return { error: error.message };
    await audit(u, "area.upsert", "service_area", id || row.name, row);
    revalidatePath("/admin/service-areas");
    revalidatePath("/service-areas");
    revalidatePath("/");
    return { success: "Service area saved." };
  } catch (e) { return fail(e); }
}

export async function upsertLaneAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("areas.manage");
    const row = {
      origin_area_id: String(fd.get("origin_area_id")),
      destination_area_id: String(fd.get("destination_area_id")),
      service_codes: fd.getAll("service_codes").map(String),
      surcharge_cents: cents(fd.get("surcharge")) ?? 0,
      transit_days: num(fd.get("transit_days")) ?? 1,
      is_active: fd.get("is_active") === "on",
    };
    if (row.origin_area_id === row.destination_area_id) return { error: "Choose two different areas." };
    const admin = createAdminClient();
    const { error } = await admin.from("area_routes").upsert(row, { onConflict: "origin_area_id,destination_area_id" });
    if (error) return { error: error.message };
    if (fd.get("both_ways") === "on") await admin.from("area_routes").upsert({ ...row, origin_area_id: row.destination_area_id, destination_area_id: row.origin_area_id }, { onConflict: "origin_area_id,destination_area_id" });
    await audit(u, "lane.upsert", "area_route", `${row.origin_area_id}->${row.destination_area_id}`, row);
    revalidatePath("/admin/service-areas");
    return { success: "Intercity lane saved." };
  } catch (e) { return fail(e); }
}

export async function upsertPromoAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("promos.manage");
    const row = {
      code: String(fd.get("code")).trim().toUpperCase(),
      description: String(fd.get("description") ?? "") || null,
      percent_off: num(fd.get("percent_off")),
      amount_off_cents: cents(fd.get("amount_off")),
      max_redemptions: num(fd.get("max_redemptions")),
      valid_from: String(fd.get("valid_from") || "") || null,
      valid_until: String(fd.get("valid_until") || "") || null,
      is_active: fd.get("is_active") === "on",
    };
    if (!/^[A-Z0-9_-]{3,40}$/.test(row.code)) return { error: "Code must be 3–40 letters/numbers." };
    if (row.percent_off == null && row.amount_off_cents == null) return { error: "Set a percent or amount off." };
    const { error } = await createAdminClient().from("promo_codes").upsert(row, { onConflict: "code" });
    if (error) return { error: error.message };
    await audit(u, "promo.upsert", "promo_code", row.code, row);
    revalidatePath("/admin/discounts");
    return { success: `Promo ${row.code} saved.` };
  } catch (e) { return fail(e); }
}

export async function updateSettingAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const key = String(fd.get("key"));
    const u = await assertPermission(key === "company" ? "settings.manage" : "pricing.manage");
    let value: unknown;
    try { value = JSON.parse(String(fd.get("value"))); } catch { return { error: "Value must be valid JSON." }; }
    const { error } = await createAdminClient().from("platform_settings").upsert({ key, value, updated_by: u.id });
    if (error) return { error: error.message };
    await audit(u, "setting.update", "platform_setting", key, { value });
    revalidatePath("/admin/settings");
    revalidatePath("/admin/website");
    return { success: "Setting saved." };
  } catch (e) { return fail(e); }
}

export async function saveCompanyAction(_: FormState, fd: FormData): Promise<FormState> {
  const value = JSON.stringify({ name: String(fd.get("name") ?? ""), support_email: String(fd.get("support_email") ?? ""), phone: String(fd.get("phone") ?? ""), address: String(fd.get("address") ?? "") });
  const f = new FormData(); f.set("key", "company"); f.set("value", value);
  const r = await updateSettingAction({}, f);
  revalidatePath("/contact");
  return r;
}

// ───────────── People ─────────────
export async function createEmployeeAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("employees.manage");
    const p = z.object({ email: z.string().email(), full_name: z.string().min(2), role: z.string(), title: z.string().max(80).optional(), department: z.string().max(80).optional() }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: "Enter name, email and role." };
    if (!assignableRoles(u.role).includes(p.data.role as Role)) return { error: "You can't assign that role." };
    const admin = createAdminClient();
    const id = await ensureProfile(p.data.email, p.data.full_name);
    await admin.from("profiles").update({ role: p.data.role, full_name: p.data.full_name, is_active: true }).eq("id", id);
    await admin.from("employees").upsert({ profile_id: id, title: p.data.title || null, department: p.data.department || null, created_by: u.id, hired_on: new Date().toISOString().slice(0, 10) }, { onConflict: "profile_id" });
    await audit(u, "employee.create", "profile", id, { role: p.data.role });
    revalidatePath("/admin/employees");
    return { success: `${p.data.full_name} added as ${p.data.role.replace("_", " ")}. An invitation email was sent if they were new.` };
  } catch (e) { return fail(e); }
}

export async function changeRoleAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("employees.manage");
    const id = String(fd.get("profile_id"));
    const role = String(fd.get("role")) as Role;
    if (id === u.id) return { error: "You can't change your own role." };
    if (role !== "customer" && !assignableRoles(u.role).includes(role)) return { error: "You can't assign that role." };
    const admin = createAdminClient();
    if (role === "super_admin" || (await admin.from("profiles").select("role").eq("id", id).single()).data?.role === "super_admin") {
      const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "super_admin").eq("is_active", true);
      if (role !== "super_admin" && (count ?? 0) <= 1) return { error: "At least one super administrator is required." };
    }
    await admin.from("profiles").update({ role }).eq("id", id);
    if (role === "customer") await admin.from("employees").delete().eq("profile_id", id);
    await audit(u, "employee.role", "profile", id, { role });
    revalidatePath("/admin/employees");
    return { success: "Role updated." };
  } catch (e) { return fail(e); }
}

export async function setAccountActiveAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("customers.manage");
    const id = String(fd.get("profile_id"));
    if (id === u.id) return { error: "You can't deactivate yourself." };
    const active = fd.get("active") === "true";
    const admin = createAdminClient();
    const { data: target } = await admin.from("profiles").select("role").eq("id", id).single();
    if (target && target.role !== "customer" && !u.role.startsWith("super")) return { error: "Only a super administrator can deactivate staff or drivers." };
    await admin.from("profiles").update({ is_active: active }).eq("id", id);
    if (!active) await admin.auth.admin.signOut(id).catch(() => null);
    await audit(u, active ? "account.activate" : "account.deactivate", "profile", id);
    revalidatePath("/admin/customers");
    return { success: active ? "Account reactivated." : "Account deactivated." };
  } catch (e) { return fail(e); }
}

// ───────────── Invoices ─────────────
export async function generateInvoiceAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("invoices.manage");
    const p = z.object({ business_id: z.string().uuid(), period_start: z.string(), period_end: z.string() }).safeParse(Object.fromEntries(fd));
    if (!p.success || p.data.period_end < p.data.period_start) return { error: "Choose a business and a valid period." };
    const admin = createAdminClient();
    const { data: biz } = await admin.from("businesses").select("id, name, email, payment_terms_days, owner_profile_id").eq("id", p.data.business_id).single();
    const { data: ships } = await admin
      .from("shipments")
      .select("id, subtotal_cents, discount_cents, tax_cents, total_cents")
      .eq("business_id", p.data.business_id)
      .eq("billing_method", "invoice")
      .is("invoice_id", null)
      .neq("status", "cancelled")
      .gte("created_at", p.data.period_start)
      .lte("created_at", p.data.period_end + "T23:59:59");
    if (!biz) return { error: "Business not found." };
    if (!ships?.length) return { error: "No uninvoiced shipments in that period." };
    const sub = ships.reduce((s, x) => s + x.subtotal_cents - x.discount_cents, 0);
    const tax = ships.reduce((s, x) => s + x.tax_cents, 0);
    const due = new Date(); due.setDate(due.getDate() + biz.payment_terms_days);
    const { data: inv, error } = await admin.from("invoices").insert({
      invoice_number: generateInvoiceNumber(), business_id: biz.id, period_start: p.data.period_start, period_end: p.data.period_end,
      subtotal_cents: sub, tax_cents: tax, total_cents: sub + tax, status: "issued", due_date: due.toISOString().slice(0, 10), created_by: u.id,
    }).select("id, invoice_number").single();
    if (error || !inv) return { error: error?.message ?? "Couldn't create invoice." };
    await admin.from("shipments").update({ invoice_id: inv.id }).in("id", ships.map((s) => s.id));
    await notify({ audience: "business", template: "business.invoice", to: biz.email, profileId: biz.owner_profile_id, subject: `Invoice ${inv.invoice_number} from 8th Flame Delivery`, heading: `Invoice ${inv.invoice_number}`, paragraphs: [`${ships.length} shipments from ${p.data.period_start} to ${p.data.period_end}.`, `Amount due: ${formatCents(sub + tax)} by ${due.toISOString().slice(0, 10)}.`], cta: { label: "View invoice", url: `${env.siteUrl}/business/portal/invoices` } });
    await audit(u, "invoice.generate", "invoice", inv.id, { shipments: ships.length, total: sub + tax });
    revalidatePath("/admin/invoices");
    return { success: `Invoice ${inv.invoice_number} issued for ${formatCents(sub + tax)}.` };
  } catch (e) { return fail(e); }
}

export async function markInvoicePaidAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u = await assertPermission("invoices.manage");
    const id = String(fd.get("id"));
    const ref = String(fd.get("reference") ?? "").trim();
    if (ref.length < 2) return { error: "Enter a payment reference (cheque #, EFT id…)." };
    const admin = createAdminClient();
    const { data: inv } = await admin.from("invoices").select("*").eq("id", id).single();
    if (!inv || inv.status === "paid" || inv.status === "void") return { error: "Invoice isn't payable." };
    await admin.from("invoices").update({ status: "paid", paid_at: new Date().toISOString(), paid_marked_by: u.id, payment_reference: ref }).eq("id", id);
    await admin.from("payments").insert({ invoice_id: id, provider: "offline", amount_cents: inv.total_cents, status: "paid", paid_at: new Date().toISOString(), receipt_number: `OFF-${inv.invoice_number}` });
    await audit(u, "invoice.mark_paid", "invoice", id, { reference: ref, amount: inv.total_cents });
    revalidatePath("/admin/invoices");
    return { success: "Invoice marked paid. Recorded in the audit log." };
  } catch (e) { return fail(e); }
}

// ───────────── Support ─────────────
export async function staffTicketAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const u: SessionUser = await assertPermission("support.manage");
    const id = String(fd.get("ticket_id"));
    const admin = createAdminClient();
    const { data: t } = await admin.from("support_tickets").select("*").eq("id", id).single();
    if (!t) return { error: "Ticket not found." };
    const body = String(fd.get("body") ?? "").trim();
    const internal = fd.get("internal") === "on";
    if (body) {
      await admin.from("support_messages").insert({ ticket_id: id, author_profile_id: u.id, author_label: `${u.fullName ?? "8th Flame Support"} (8th Flame)`, body: body.slice(0, 5000), is_internal: internal });
      if (!internal) await notify({ audience: "customer", template: "support.reply", to: t.contact_email, profileId: t.profile_id, subject: `Re: ${t.subject} (${t.ticket_number})`, heading: "We replied to your request", paragraphs: [body], cta: t.profile_id ? { label: "View ticket", url: `${env.siteUrl}/account/support/${id}` } : undefined });
    }
    const status = String(fd.get("status") || t.status);
    const patch: Record<string, unknown> = { status, priority: String(fd.get("priority") || t.priority), assigned_to: String(fd.get("assigned_to") || "") || null };
    if (!internal && body && status === "open") patch.status = "waiting_on_customer";
    if (["resolved", "closed"].includes(String(patch.status))) patch.closed_at = new Date().toISOString();
    await admin.from("support_tickets").update(patch).eq("id", id);
    await audit(u, "support.update", "support_ticket", id, { ...patch, replied: !!body, internal });
    revalidatePath(`/admin/support/${id}`);
    return { success: "Ticket updated." };
  } catch (e) { return fail(e); }
}
