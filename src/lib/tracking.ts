import type { ShipmentStatus } from "@/lib/status";

export interface RawShipment {
  tracking_number: string;
  status: ShipmentStatus;
  service_code: string;
  created_at: string;
  pickup_city: string;
  pickup_province: string;
  delivery_city: string;
  delivery_province: string;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  package_count: number;
  payment_status: string;
  [k: string]: unknown;
}

export interface RawEvent {
  status: ShipmentStatus;
  location: string | null;
  notes: string | null;
  is_public: boolean;
  created_at: string;
  pod_recipient_name?: string | null;
  [k: string]: unknown;
}

/** Strips every personal field before anything goes to the public tracking page. */
export function toPublicTracking(s: RawShipment, events: RawEvent[]) {
  const pub = events.filter((e) => e.is_public).sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    tracking_number: s.tracking_number,
    status: s.status,
    service_code: s.service_code,
    created_at: s.created_at,
    origin: `${s.pickup_city}, ${s.pickup_province}`,
    destination: `${s.delivery_city}, ${s.delivery_province}`,
    estimated_delivery_date: s.status === "delivered" || s.status === "cancelled" ? null : s.estimated_delivery_date,
    delivered_at: s.delivered_at,
    package_count: s.package_count,
    events: pub.map((e) => ({
      status: e.status,
      location: e.location,
      notes: e.notes,
      at: e.created_at,
      // only the first initial + surname length hint — never a full name
      signed_by: e.status === "delivered" && e.pod_recipient_name ? maskName(e.pod_recipient_name) : null,
    })),
  };
}

export type PublicTracking = ReturnType<typeof toPublicTracking>;

export function maskName(n: string) {
  const parts = n.trim().split(/\s+/);
  return parts.map((p) => p[0]?.toUpperCase() + ".").join(" ");
}
