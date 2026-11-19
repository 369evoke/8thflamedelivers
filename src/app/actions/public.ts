"use server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { businessApplicationSchema, contactSchema, driverApplicationSchema } from "@/lib/validation";
import { generateTicketNumber, normalizeTracking } from "@/lib/identifiers";
import { notify, notifyStaff } from "@/lib/notify";
import { integrations } from "@/lib/env";
import type { FormState } from "./auth";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX = 10 * 1024 * 1024;

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fe: Record<string, string> = {};
  issues.forEach((i) => (fe[String(i.path[0])] ??= i.message));
  return fe;
}

const notReady = { error: "This form isn't connected to the database yet. Please try again later." };

export async function submitDriverApplication(_: FormState, fd: FormData): Promise<FormState> {
  if (!integrations.supabase()) return notReady;
  if (!(await rateLimit("driver-app", 3, 10 * 60_000)).ok) return { error: "Too many submissions. Please try later." };
  const parsed = driverApplicationSchema.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), error: "Please check the highlighted fields." };

  const files = fd.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { fieldErrors: { documents: "Upload your driver's licence and proof of insurance." } };
  if (files.length > 5) return { fieldErrors: { documents: "Upload at most 5 files." } };
  for (const f of files) {
    if (!ALLOWED.includes(f.type)) return { fieldErrors: { documents: `${f.name}: only PDF, JPG, PNG or WEBP files are accepted.` } };
    if (f.size > MAX) return { fieldErrors: { documents: `${f.name}: files must be under 10 MB.` } };
  }

  const admin = createAdminClient();
  const user = await getSessionUser();
  const folder = randomUUID();
  const paths: string[] = [];
  for (const f of files) {
    const ext = f.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const p = `${folder}/${randomUUID()}.${ext}`;
    const { error } = await admin.storage.from("driver-documents").upload(p, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
    if (error) return { error: "We couldn't upload your documents. Please try again." };
    paths.push(p);
  }

  const { consent: _c, ...data } = parsed.data;
  void _c;
  const { error } = await admin.from("driver_applications").insert({ ...data, profile_id: user?.id ?? null, document_paths: paths });
  if (error) return { error: "We couldn't save your application. Please try again." };

  await notify({
    audience: "driver",
    template: "driver.application_received",
    to: data.email,
    subject: "We received your driver application",
    heading: "Application received",
    paragraphs: [`Thanks, ${data.full_name}. Our team will review your application and documents and contact you by email.`],
  });
  await notifyStaff("staff.driver_application", "New driver application", [`${data.full_name} — ${data.city}, ${data.province} (${data.vehicle_type})`], "/admin/driver-applications");
  return { success: "Application submitted. We'll be in touch by email." };
}

export async function submitBusinessApplication(_: FormState, fd: FormData): Promise<FormState> {
  if (!integrations.supabase()) return notReady;
  if (!(await rateLimit("biz-app", 3, 10 * 60_000)).ok) return { error: "Too many submissions. Please try later." };
  const user = await getSessionUser();
  if (!user) return { error: "Please sign in or create an account first, so we can link the business to you." };
  const parsed = businessApplicationSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), error: "Please check the highlighted fields." };

  const admin = createAdminClient();
  const { data: biz, error } = await admin.from("businesses").insert({ ...parsed.data, owner_profile_id: user.id }).select("id").single();
  if (error || !biz) return { error: "We couldn't save your application. Please try again." };
  await admin.from("business_members").insert({ business_id: biz.id, profile_id: user.id, member_role: "owner" });

  await notify({
    audience: "business",
    template: "business.application_received",
    to: parsed.data.email,
    profileId: user.id,
    subject: "Business account application received",
    heading: "Application received",
    paragraphs: [`Thanks for applying for a business shipping account for ${parsed.data.name}. We'll review it and email you once a decision is made.`],
  });
  await notifyStaff("staff.business_application", "New business account application", [`${parsed.data.name} — est. ${parsed.data.estimated_monthly_volume} shipments/month`], "/admin/businesses");
  return { success: "Application submitted. You'll get an email once it's reviewed." };
}

export async function submitContact(_: FormState, fd: FormData): Promise<FormState> {
  if (!integrations.supabase()) return notReady;
  if (!(await rateLimit("contact", 5, 10 * 60_000)).ok) return { error: "Too many messages. Please try later." };
  const parsed = contactSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), error: "Please check the highlighted fields." };
  const user = await getSessionUser();
  const admin = createAdminClient();

  let shipmentId: string | null = null;
  if (parsed.data.tracking_number) {
    const { data: s } = await admin.from("shipments").select("id, customer_profile_id, sender_email").eq("tracking_number", normalizeTracking(parsed.data.tracking_number)).maybeSingle();
    // only link when the requester plausibly owns it, to avoid leaking data through tickets
    if (s && (s.customer_profile_id === user?.id || s.sender_email?.toLowerCase() === parsed.data.email.toLowerCase())) shipmentId = s.id;
  }

  const ticketNumber = generateTicketNumber();
  const { data: t, error } = await admin
    .from("support_tickets")
    .insert({
      ticket_number: ticketNumber,
      profile_id: user?.id ?? null,
      contact_email: parsed.data.email,
      contact_name: parsed.data.name,
      shipment_id: shipmentId,
      category: parsed.data.category,
      subject: parsed.data.subject,
      priority: ["missing_shipment", "damage"].includes(parsed.data.category) ? "high" : "normal",
    })
    .select("id")
    .single();
  if (error || !t) return { error: "We couldn't send your message. Please try again." };
  await admin.from("support_messages").insert({ ticket_id: t.id, author_profile_id: user?.id ?? null, author_label: parsed.data.name, body: parsed.data.message });

  await notify({
    audience: "customer",
    template: "support.received",
    to: parsed.data.email,
    profileId: user?.id,
    subject: `We received your request (${ticketNumber})`,
    heading: "We're on it",
    paragraphs: [`Your support ticket ${ticketNumber} has been created. Our team will reply by email.`],
  });
  await notifyStaff("staff.support", `Support request ${ticketNumber}`, [parsed.data.subject], "/admin/support");
  return { success: `Thanks — your ticket number is ${ticketNumber}.` };
}
