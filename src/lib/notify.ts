import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { renderEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { STATUS_LABELS, type ShipmentStatus } from "@/lib/status";

type Audience = "customer" | "driver" | "staff" | "business";

interface NotifyInput {
  audience: Audience;
  template: string;
  to: string | null | undefined;
  profileId?: string | null;
  shipmentId?: string | null;
  subject: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
}

/** Records the notification and sends it by email. SMS is reserved via the `channel` column. */
export async function notify(n: NotifyInput) {
  const admin = createAdminClient();
  const body = n.paragraphs.join("\n\n");
  const result = n.to ? await sendEmail(n.to, n.subject, renderEmail(n.heading, n.paragraphs, n.cta)) : { status: "skipped" as const };
  await admin.from("notifications").insert({
    profile_id: n.profileId ?? null,
    audience: n.audience,
    recipient_email: n.to ?? null,
    channel: "email",
    template: n.template,
    subject: n.subject,
    body,
    shipment_id: n.shipmentId ?? null,
    delivery_status: result.status,
    provider_message_id: "id" in result ? result.id : null,
    error: "error" in result ? result.error : null,
  });
}

export async function notifyStaff(template: string, subject: string, paragraphs: string[], path = "/admin") {
  await notify({ audience: "staff", template, to: env.opsEmail || null, subject, heading: subject, paragraphs, cta: { label: "Open admin", url: env.siteUrl + path } });
}

/** Customer-facing emails for the statuses listed in the spec. */
const CUSTOMER_STATUS_EMAILS: Partial<Record<ShipmentStatus, string>> = {
  awaiting_confirmation: "We received your shipment booking. Our team will review and confirm it shortly.",
  confirmed: "Your booking has been confirmed by our operations team.",
  pickup_scheduled: "Your pickup has been scheduled.",
  driver_assigned: "A driver has been assigned to your shipment.",
  picked_up: "Your package has been picked up.",
  in_transit: "Your shipment is in transit.",
  out_for_delivery: "Your package is out for delivery today.",
  delivered: "Your package has been delivered.",
  delayed: "Your shipment has been delayed. We're working to get it moving and will keep you updated.",
  exception: "There's an issue with your shipment that needs attention. Our team has been notified.",
  delivery_attempted: "We attempted delivery but could not complete it. We'll be in touch about next steps.",
};

export async function notifyShipmentStatus(shipmentId: string, status: ShipmentStatus, note?: string | null) {
  const message = CUSTOMER_STATUS_EMAILS[status];
  if (!message) return;
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("shipments")
    .select("tracking_number, sender_email, customer_profile_id, guest_email")
    .eq("id", shipmentId)
    .single();
  if (!s) return;
  const paragraphs = [message, `Tracking number: ${s.tracking_number}`];
  if (note) paragraphs.push(note);
  await notify({
    audience: "customer",
    template: `shipment.${status}`,
    to: s.sender_email || s.guest_email,
    profileId: s.customer_profile_id,
    shipmentId,
    subject: `${STATUS_LABELS[status]} — ${s.tracking_number}`,
    heading: STATUS_LABELS[status],
    paragraphs,
    cta: { label: "Track shipment", url: `${env.siteUrl}/track/${s.tracking_number}` },
  });
  if (status === "exception") {
    await notifyStaff("staff.exception", `Delivery exception: ${s.tracking_number}`, [note || "A driver reported an exception."], `/admin/shipments/${shipmentId}`);
  }
}
