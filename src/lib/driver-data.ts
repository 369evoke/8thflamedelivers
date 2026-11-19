import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/** Active shipments assigned to this driver. Server-side, filtered by driver id. */
export async function driverAssignments(driverId: string) {
  const { data } = await createAdminClient()
    .from("shipment_assignments")
    .select("assignment_type, route_id, shipments!inner(id, tracking_number, status, pickup_date, pickup_window, pickup_street, pickup_city, pickup_postal, delivery_street, delivery_city, delivery_postal, recipient_name, package_count)")
    .eq("driver_id", driverId)
    .eq("is_active", true)
    .order("created_at");
  return (data ?? []).map((a) => ({ ...(a.shipments as unknown as Record<string, string | number>), assignment_type: a.assignment_type, route_id: a.route_id })) as Array<{
    id: string; tracking_number: string; status: import("@/lib/status").ShipmentStatus; pickup_date: string; pickup_window: string; pickup_street: string; pickup_city: string; pickup_postal: string;
    delivery_street: string; delivery_city: string; delivery_postal: string; recipient_name: string; package_count: number; assignment_type: string; route_id: string | null;
  }>;
}

export const mapsLink = (addr: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
