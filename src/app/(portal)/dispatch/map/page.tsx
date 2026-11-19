import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { OpsMap, type MapPoint } from "@/components/dashboard/OpsMap";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const { data } = await createAdminClient()
    .from("shipments")
    .select("id, tracking_number, status, pickup_lat, pickup_lng, delivery_lat, delivery_lng, pickup_city, delivery_city")
    .in("status", ["confirmed", "pickup_scheduled", "driver_assigned", "driver_en_route_pickup", "picked_up", "in_transit", "out_for_delivery", "delayed", "delivery_attempted"])
    .limit(300);
  const pickupPhase = ["confirmed", "pickup_scheduled", "driver_assigned", "driver_en_route_pickup"];
  const points: MapPoint[] = (data ?? []).flatMap((s) => {
    const pick = pickupPhase.includes(s.status);
    const lat = pick ? s.pickup_lat : s.delivery_lat, lng = pick ? s.pickup_lng : s.delivery_lng;
    return lat && lng ? [{ id: s.id, lat, lng, kind: pick ? "pickup" : "delivery", label: s.tracking_number, href: `/admin/shipments/${s.id}` } as MapPoint] : [];
  });
  return (
    <>
      <DashTitle title="Operations map" sub="Next stop for each open shipment: pickup location before pickup, destination after." />
      <OpsMap points={points} />
      <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((s) => <li key={s.id}><Link href={`/admin/shipments/${s.id}`} className="font-mono underline">{s.tracking_number}</Link> <span className="text-muted">{s.pickup_city} → {s.delivery_city}</span></li>)}
      </ul>
    </>
  );
}
