import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { createAdminClient } from "@/lib/supabase/server";
import { approvedDrivers } from "@/lib/ops-data";
import { createRouteAction } from "@/app/actions/ops";

export const dynamic = "force-dynamic";

export default async function Routes() {
  const admin = createAdminClient();
  const [{ data: routes }, drivers, { data: areas }] = await Promise.all([
    admin.from("delivery_routes").select("id, name, route_date, status, drivers(profiles(full_name)), route_stops(id, completed_at)").order("route_date", { ascending: false }).limit(100),
    approvedDrivers(),
    admin.from("service_areas").select("id, name").order("sort_order"),
  ]);
  return (
    <>
      <DashTitle title="Delivery routes" sub="Group shipments into ordered routes for a driver. Route optimization is planned; order stops manually for now." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {!routes?.length ? <EmptyState title="No routes yet" /> : routes.map((r) => {
            const stops = r.route_stops ?? [];
            const driver = (r.drivers as unknown as { profiles: { full_name: string } } | null)?.profiles?.full_name;
            return (
              <Link key={r.id} href={`/dispatch/routes/${r.id}`} className="block"><Card className="hover:border-gold">
                <div className="flex items-center justify-between"><p className="font-semibold">{r.name}</p><Badge tone={r.status === "completed" ? "success" : r.status === "active" ? "gold" : "neutral"}>{r.status}</Badge></div>
                <p className="text-sm text-muted">{r.route_date} · {driver ?? "No driver"} · {stops.filter((s) => s.completed_at).length}/{stops.length} stops done</p>
              </Card></Link>
            );
          })}
        </div>
        <Card>
          <h2 className="mb-4 font-bold">New route</h2>
          <ActionForm action={createRouteAction} submit="Create route" resetOnSuccess>
            <input name="name" placeholder="Route name (e.g. Downtown AM)" className="field" required />
            <input name="route_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="field" required />
            <select name="driver_id" className="field" defaultValue=""><option value="">Assign driver later</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}{d.available ? "" : " (off)"}</option>)}</select>
            <select name="area_id" className="field" defaultValue=""><option value="">Any area</option>{areas?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <textarea name="notes" rows={2} placeholder="Notes" className="field" />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
