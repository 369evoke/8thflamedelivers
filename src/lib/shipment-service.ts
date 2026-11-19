import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { buildQuotes, estimateDeliveryDate, loadSettings } from "@/lib/quote-service";
import { checkPackages, type BookingInput } from "@/lib/validation";
import { generateAccessToken, generateShipmentReference, generateTrackingNumber } from "@/lib/identifiers";
import { hashToken } from "@/lib/tokens";
import { geocode } from "@/lib/maps";
import { canTransition, type ShipmentStatus } from "@/lib/status";
import { notify, notifyShipmentStatus, notifyStaff } from "@/lib/notify";
import { env } from "@/lib/env";
import { formatCents, PricingError } from "@/lib/pricing";
import type { SessionUser } from "@/lib/auth";

export class BookingError extends Error {
  constructor(message: string, public details: string[] = []) {
    super(message);
  }
}

/**
 * Creates a shipment. Price is ALWAYS recomputed here from database rates — client totals are ignored.
 * Card bookings stay `shipment_created` + `unpaid` until the Stripe webhook verifies payment.
 * Approved invoicing businesses move straight to `awaiting_confirmation`.
 */
export async function createShipment(input: BookingInput, user: SessionUser | null) {
  const admin = createAdminClient();
  const settings = await loadSettings();

  const problems = checkPackages(input.packages, settings.limits, settings.restricted);
  if (problems.length) throw new BookingError("Please fix the package details.", problems);

  const today = new Date().toISOString().slice(0, 10);
  if (input.pickup_date < today) throw new BookingError("Pickup date can't be in the past.");
  if (settings.pickupWindows.length && !settings.pickupWindows.includes(input.pickup_window)) {
    throw new BookingError("Please choose an available pickup window.");
  }

  // Business checks
  let businessId: string | null = null;
  if (input.business_id) {
    if (!user?.businesses.some((b) => b.id === input.business_id && b.status === "approved")) {
      throw new BookingError("You're not an authorized member of that business account.");
    }
    businessId = input.business_id;
  }

  const quotes = await buildQuotes({
    pickup: { street: input.sender.street, city: input.sender.city, province: input.sender.province, postal: input.sender.postal },
    delivery: { street: input.recipient.street, city: input.recipient.city, province: input.recipient.province, postal: input.recipient.postal },
    packages: input.packages,
    promoCode: input.promo_code || null,
    businessId,
    serviceCode: input.service_code,
  }).catch((e) => {
    if (e instanceof PricingError) throw new BookingError(e.message);
    throw e;
  });

  const option = quotes.options.find((o) => o.service.code === input.service_code);
  if (!option) throw new BookingError("That service isn't available for this route.");
  if (!option.price) throw new BookingError(option.error ?? "Unable to price this shipment.");
  if (option.service.same_day && input.pickup_date !== today) {
    // same-day means pickup today; allow future dates but label clearly
  }

  const useInvoice = input.billing_method === "invoice";
  if (useInvoice && !quotes.business?.invoicing_enabled) throw new BookingError("Invoice billing isn't enabled for this account.");

  const [pickupGeo, deliveryGeo] = await Promise.all([
    geocode(`${input.sender.street}, ${input.sender.city}, ${input.sender.province} ${input.sender.postal}`),
    geocode(`${input.recipient.street}, ${input.recipient.city}, ${input.recipient.province} ${input.recipient.postal}`),
  ]);

  const guestToken = user ? null : generateAccessToken();
  const price = option.price;
  const pkgCount = input.packages.reduce((s, p) => s + p.quantity, 0);

  let shipment: { id: string; tracking_number: string; reference: string } | null = null;
  for (let attempt = 0; attempt < 3 && !shipment; attempt++) {
    const { data, error } = await admin
      .from("shipments")
      .insert({
        reference: generateShipmentReference(),
        tracking_number: generateTrackingNumber(),
        customer_profile_id: user?.id ?? null,
        business_id: businessId,
        guest_email: user ? null : input.sender.email,
        guest_access_token: guestToken ? hashToken(guestToken) : null,
        service_code: option.service.code,
        status: useInvoice ? "awaiting_confirmation" : "shipment_created",
        payment_status: useInvoice ? "invoiced" : "unpaid",
        billing_method: useInvoice ? "invoice" : "card",
        sender_name: input.sender.name, sender_phone: input.sender.phone, sender_email: input.sender.email,
        pickup_street: input.sender.street, pickup_unit: input.sender.unit, pickup_city: input.sender.city,
        pickup_province: input.sender.province, pickup_postal: input.sender.postal, pickup_instructions: input.sender.instructions,
        pickup_lat: pickupGeo?.lat ?? quotes.lane.pickupArea.center_lat, pickup_lng: pickupGeo?.lng ?? quotes.lane.pickupArea.center_lng,
        pickup_date: input.pickup_date, pickup_window: input.pickup_window, pickup_area_id: quotes.lane.pickupArea.id,
        recipient_name: input.recipient.name, recipient_phone: input.recipient.phone, recipient_email: input.recipient.email,
        delivery_street: input.recipient.street, delivery_unit: input.recipient.unit, delivery_city: input.recipient.city,
        delivery_province: input.recipient.province, delivery_postal: input.recipient.postal, delivery_instructions: input.recipient.instructions,
        delivery_lat: deliveryGeo?.lat ?? quotes.lane.deliveryArea.center_lat, delivery_lng: deliveryGeo?.lng ?? quotes.lane.deliveryArea.center_lng,
        delivery_area_id: quotes.lane.deliveryArea.id,
        distance_km: quotes.distance.km, distance_source: quotes.distance.source,
        package_count: pkgCount,
        total_weight_kg: price.actual_weight_kg,
        billable_weight_kg: price.billable_weight_kg,
        price_breakdown: price,
        subtotal_cents: price.subtotal_cents, discount_cents: price.discount_cents, tax_cents: price.tax_cents, total_cents: price.total_cents,
        promo_code: quotes.promoApplied ? input.promo_code : null,
        estimated_delivery_date: estimateDeliveryDate(input.pickup_date, Math.max(option.service.transit_days, quotes.lane.transitDays), option.service.same_day),
        created_by: user?.id ?? null,
      })
      .select("id, tracking_number, reference")
      .single();
    if (!error) shipment = data;
    else if (error.code !== "23505") throw new Error(error.message); // retry only on unique collision
  }
  if (!shipment) throw new Error("Could not allocate a tracking number. Please try again.");

  await admin.from("shipment_packages").insert(
    input.packages.map((p) => ({
      shipment_id: shipment!.id,
      package_type: p.package_type,
      description: p.description,
      quantity: p.quantity,
      weight_kg: p.weight_kg,
      length_cm: p.length_cm,
      width_cm: p.width_cm,
      height_cm: p.height_cm,
      special_handling: p.special_handling,
      declared_value_cents: p.declared_value ? Math.round(p.declared_value * 100) : null,
    })),
  );

  await recordEvent(shipment.id, "shipment_created", { actor: user, notes: "Shipment booked online.", skipTransitionCheck: true, silent: true });
  if (useInvoice) {
    await recordEvent(shipment.id, "awaiting_confirmation", { actor: null, notes: "Billed to business account.", skipTransitionCheck: true });
    await notifyStaff("staff.new_shipment", `New shipment request ${shipment.tracking_number}`, ["A business shipment is awaiting confirmation."], `/admin/shipments/${shipment.id}`);
  }

  return { ...shipment, total_cents: price.total_cents, guestToken, billing: useInvoice ? "invoice" : "card" };
}

interface EventOpts {
  actor: SessionUser | null;
  actorLabel?: string;
  location?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  isPublic?: boolean;
  skipTransitionCheck?: boolean;
  silent?: boolean;
  pod?: { recipientName?: string | null; photoPath?: string | null; signaturePath?: string | null };
}

/** The single path for every status change. Validates the transition, writes the event, updates the shipment, notifies. */
export async function recordEvent(shipmentId: string, to: ShipmentStatus, o: EventOpts) {
  const admin = createAdminClient();
  const { data: s } = await admin.from("shipments").select("status").eq("id", shipmentId).single();
  if (!s) throw new Error("Shipment not found.");
  const from = s.status as ShipmentStatus;
  if (!o.skipTransitionCheck && !canTransition(from, to)) {
    throw new BookingError(`Cannot move a shipment from "${from}" to "${to}".`);
  }

  const label = o.actorLabel ?? (o.actor ? `${o.actor.fullName ?? o.actor.email} (${o.actor.role})` : "system");
  const { error } = await admin.from("shipment_events").insert({
    shipment_id: shipmentId,
    status: to,
    location: o.location ?? null,
    notes: o.notes ?? null,
    internal_notes: o.internalNotes ?? null,
    is_public: o.isPublic ?? true,
    actor_profile_id: o.actor?.id ?? null,
    actor_label: label,
    pod_recipient_name: o.pod?.recipientName ?? null,
    pod_photo_path: o.pod?.photoPath ?? null,
    pod_signature_path: o.pod?.signaturePath ?? null,
  });
  if (error) throw new Error(error.message);

  const patch: Record<string, unknown> = { status: to };
  if (to === "delivered") patch.delivered_at = new Date().toISOString();
  if (to === "cancelled") patch.cancelled_at = new Date().toISOString();
  await admin.from("shipments").update(patch).eq("id", shipmentId);

  if (!o.silent) await notifyShipmentStatus(shipmentId, to, o.isPublic === false ? null : o.notes);
}

/** Called only by the verified Stripe webhook. Idempotent. */
export async function markShipmentPaid(shipmentId: string, sessionId: string, paymentIntentId: string | null, amountCents: number) {
  const admin = createAdminClient();
  const { data: pay } = await admin.from("payments").select("id, status").eq("stripe_checkout_session_id", sessionId).maybeSingle();
  if (pay?.status === "paid") return;

  const { data: s } = await admin.from("shipments").select("*").eq("id", shipmentId).single();
  if (!s) throw new Error("Shipment not found for payment");
  if (amountCents !== s.total_cents) {
    await admin.from("payments").update({ status: "failed", failure_reason: `Amount mismatch: ${amountCents} vs ${s.total_cents}` }).eq("stripe_checkout_session_id", sessionId);
    await notifyStaff("staff.payment_mismatch", `Payment amount mismatch on ${s.tracking_number}`, ["Review in Stripe before confirming."]);
    return;
  }

  const receipt = (await import("@/lib/identifiers")).generateReceiptNumber();
  await admin
    .from("payments")
    .update({ status: "paid", stripe_payment_intent_id: paymentIntentId, paid_at: new Date().toISOString(), receipt_number: receipt })
    .eq("stripe_checkout_session_id", sessionId);
  await admin.from("shipments").update({ payment_status: "paid" }).eq("id", shipmentId);
  if (s.promo_code) await admin.rpc("increment_promo", { p_code: s.promo_code }).then(() => null, () => null);

  if (s.status === "shipment_created") {
    await recordEvent(shipmentId, "awaiting_confirmation", { actor: null, notes: "Payment received.", silent: true });
  }

  await notify({
    audience: "customer",
    template: "shipment.booked",
    to: s.sender_email,
    profileId: s.customer_profile_id,
    shipmentId,
    subject: `Shipment booked — ${s.tracking_number}`,
    heading: "Your shipment is booked",
    paragraphs: [
      `Thank you, ${s.sender_name}. Your payment of ${formatCents(s.total_cents)} has been received (receipt ${receipt}).`,
      `Tracking number: ${s.tracking_number} · Reference: ${s.reference}`,
      `Pickup: ${s.pickup_street}, ${s.pickup_city} on ${s.pickup_date} (${s.pickup_window}).`,
      `Delivery to: ${s.recipient_name}, ${s.delivery_city}, ${s.delivery_province}.`,
      "Our operations team will confirm your booking and schedule the pickup. You'll receive updates by email.",
    ],
    cta: { label: "Track shipment", url: `${env.siteUrl}/track/${s.tracking_number}` },
  });
  await notifyStaff("staff.new_shipment", `New paid shipment ${s.tracking_number}`, [`${formatCents(s.total_cents)} — awaiting confirmation.`], `/admin/shipments/${shipmentId}`);
}
