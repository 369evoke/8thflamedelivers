import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

export async function approvedDrivers() {
  const { data } = await createAdminClient()
    .from("drivers")
    .select("id, is_available, vehicle_type, availability_notes, profiles!inner(full_name, phone, is_active), service_areas(name)")
    .eq("status", "approved")
    .eq("profiles.is_active", true);
  const { data: load } = await createAdminClient().from("shipment_assignments").select("driver_id").eq("is_active", true);
  const counts = new Map<string, number>();
  (load ?? []).forEach((l) => counts.set(l.driver_id, (counts.get(l.driver_id) ?? 0) + 1));
  return (data ?? []).map((d) => {
    const p = d.profiles as unknown as { full_name: string; phone: string };
    return { id: d.id, name: p.full_name ?? "Driver", phone: p.phone, available: d.is_available, vehicle: d.vehicle_type, notes: d.availability_notes, area: (d.service_areas as unknown as { name: string } | null)?.name ?? null, active: counts.get(d.id) ?? 0 };
  }).sort((a, b) => Number(b.available) - Number(a.available) || a.active - b.active);
}
export type DriverOption = Awaited<ReturnType<typeof approvedDrivers>>[number];
