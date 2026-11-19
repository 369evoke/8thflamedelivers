import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isValidTrackingNumber, normalizeTracking } from "@/lib/identifiers";
import { toPublicTracking, type RawEvent, type RawShipment } from "@/lib/tracking";
import { integrations } from "@/lib/env";

/** Unpaid card bookings are not trackable — they don't exist operationally yet. */
export async function getPublicTracking(raw: string) {
  const tn = normalizeTracking(raw);
  if (!isValidTrackingNumber(tn) || !integrations.supabase()) return null;
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("shipments")
    .select("id, tracking_number, status, service_code, created_at, pickup_city, pickup_province, delivery_city, delivery_province, estimated_delivery_date, delivered_at, package_count, payment_status")
    .eq("tracking_number", tn)
    .maybeSingle();
  if (!s || !["paid", "invoiced", "refunded", "partially_refunded"].includes(s.payment_status)) return null;
  const { data: ev } = await admin
    .from("shipment_events")
    .select("status, location, notes, is_public, created_at, pod_recipient_name")
    .eq("shipment_id", s.id)
    .order("created_at");
  return toPublicTracking(s as RawShipment, (ev ?? []) as RawEvent[]);
}
