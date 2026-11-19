import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Card, EmptyState, Stat, StatusBadge } from "@/components/ui";
import { requireDriverPage } from "@/lib/auth";
import { driverAssignments } from "@/lib/driver-data";
import { createAdminClient } from "@/lib/supabase/server";

const PICKUP_PHASE = ["confirmed", "pickup_scheduled", "driver_assigned", "driver_en_route_pickup", "delayed"];

export default async function DriverHome() {
  const u = await requireDriverPage();
  const items = await driverAssignments(u.driverId!);
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ count: done30 }, { count: attempts30 }, { data: routes }] = await Promise.all([
    admin.from("shipment_events").select("id", { count: "exact", head: true }).eq("actor_profile_id", u.id).eq("status", "delivered").gte("created_at", since),
    admin.from("shipment_events").select("id", { count: "exact", head: true }).eq("actor_profile_id", u.id).eq("status", "delivery_attempted").gte("created_at", since),
    admin.from("delivery_routes").select("id, name, route_date, status").eq("driver_id", u.driverId!).in("status", ["planned", "active"]).order("route_date"),
  ]);
  const pickups = items.filter((i) => PICKUP_PHASE.includes(i.status));
  const deliveries = items.filter((i) => !PICKUP_PHASE.includes(i.status));
  const rate = (done30 ?? 0) + (attempts30 ?? 0) ? Math.round(((done30 ?? 0) / ((done30 ?? 0) + (attempts30 ?? 0))) * 100) + "%" : "—";

  const List = ({ rows, kind }: { rows: typeof items; kind: "pickup" | "delivery" }) =>
    rows.length ? (
      <div className="space-y-3">
        {rows.map((r) => (
          <Link key={r.id} href={`/driver/shipments/${r.id}`} className="block">
            <Card className="hover:border-gold">
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-sm font-bold">{r.tracking_number}</span><StatusBadge status={r.status} /></div>
              <p className="mt-2 font-semibold">{kind === "pickup" ? `${r.pickup_street}, ${r.pickup_city}` : `${r.recipient_name} — ${r.delivery_street}, ${r.delivery_city}`}</p>
              <p className="text-xs text-muted">{kind === "pickup" ? `${r.pickup_date} · ${r.pickup_window}` : r.delivery_postal} · {r.package_count} pkg</p>
            </Card>
          </Link>
        ))}
      </div>
    ) : <EmptyState title={kind === "pickup" ? "No scheduled pickups" : "No deliveries in progress"} />;

  return (
    <>
      <DashTitle title="Today’s work" sub="Assignments from 8th Flame dispatch." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Assigned" value={items.length} />
        <Stat label="Active routes" value={routes?.length ?? 0} />
        <Stat label="Delivered (30d)" value={done30 ?? 0} />
        <Stat label="First-attempt rate (30d)" value={rate} />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section><h2 className="mb-3 font-bold">Scheduled pickups</h2><List rows={pickups} kind="pickup" /></section>
        <section><h2 className="mb-3 font-bold">Scheduled deliveries</h2><List rows={deliveries} kind="delivery" /></section>
      </div>
    </>
  );
}
