import { notFound } from "next/navigation";
import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Card, EmptyState, StatusBadge } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { OpsMap, type MapPoint } from "@/components/dashboard/OpsMap";
import { createAdminClient } from "@/lib/supabase/server";
import { approvedDrivers } from "@/lib/ops-data";
import { addStopsAction, removeStopAction, reorderStopAction, routeStatusAction } from "@/app/actions/ops";

export const dynamic = "force-dynamic";

export default async function RouteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: r } = await admin.from("delivery_routes").select("*, route_stops(id, sequence, stop_type, completed_at, shipments(id, tracking_number, status, pickup_street, pickup_city, delivery_street, delivery_city, pickup_lat, pickup_lng, delivery_lat, delivery_lng))").eq("id", id).maybeSingle();
  if (!r) notFound();
  const stops = [...(r.route_stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  const inRoute = new Set(stops.map((s) => (s.shipments as unknown as { id: string }).id));
  const [drivers, { data: candidates }] = await Promise.all([
    approvedDrivers(),
    admin.from("shipments").select("id, tracking_number, status, pickup_city, delivery_city, pickup_date").in("status", ["confirmed", "pickup_scheduled", "driver_assigned", "picked_up", "at_processing_facility", "in_transit", "at_destination_facility", "delivery_attempted", "delayed"]).order("pickup_date").limit(150),
  ]);
  const points: MapPoint[] = stops.flatMap((st) => {
    const s = st.shipments as unknown as Record<string, number | string>;
    const lat = st.stop_type === "pickup" ? s.pickup_lat : s.delivery_lat;
    const lng = st.stop_type === "pickup" ? s.pickup_lng : s.delivery_lng;
    return lat && lng ? [{ id: st.id, lat: Number(lat), lng: Number(lng), kind: st.stop_type as "pickup" | "delivery", label: `${st.sequence}. ${s.tracking_number}`, href: `/admin/shipments/${s.id}` }] : [];
  });

  return (
    <>
      <DashTitle title={r.name} sub={<Link href="/dispatch/routes" className="underline">← Routes</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-bold">Stops ({stops.length})</h2>
            {!stops.length ? <EmptyState title="No stops yet" body="Add shipments from the list." /> : (
              <ol className="space-y-2">
                {stops.map((st) => {
                  const s = st.shipments as unknown as Record<string, string>;
                  return (
                    <li key={st.id} className="flex items-center gap-3 rounded-lg border border-beige p-3 text-sm">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-charcoal text-xs font-bold text-ivory">{st.sequence}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold capitalize">{st.stop_type}: {st.stop_type === "pickup" ? `${s.pickup_street}, ${s.pickup_city}` : `${s.delivery_street}, ${s.delivery_city}`}</p>
                        <p className="text-xs"><Link className="font-mono underline" href={`/admin/shipments/${s.id}`}>{s.tracking_number}</Link> · <StatusBadge status={s.status as never} />{st.completed_at && " · done"}</p>
                      </div>
                      <form action={reorderStopAction}><input type="hidden" name="route_id" value={id} /><input type="hidden" name="stop_id" value={st.id} /><input type="hidden" name="dir" value="up" /><button aria-label="Move up" className="px-1">▲</button></form>
                      <form action={reorderStopAction}><input type="hidden" name="route_id" value={id} /><input type="hidden" name="stop_id" value={st.id} /><input type="hidden" name="dir" value="down" /><button aria-label="Move down" className="px-1">▼</button></form>
                      <form action={removeStopAction}><input type="hidden" name="route_id" value={id} /><input type="hidden" name="stop_id" value={st.id} /><button className="text-xs text-danger">Remove</button></form>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
          <OpsMap points={points} height={360} />
        </div>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-bold">Route settings</h2>
            <ActionForm action={routeStatusAction} submit="Update route">
              <input type="hidden" name="route_id" value={id} />
              <select name="status" defaultValue={r.status} className="field">{["planned", "active", "completed", "cancelled"].map((s) => <option key={s}>{s}</option>)}</select>
              <select name="driver_id" defaultValue={r.driver_id ?? ""} className="field"><option value="">— keep current driver —</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.active} active)</option>)}</select>
            </ActionForm>
          </Card>
          <Card>
            <h2 className="mb-3 font-bold">Add shipments</h2>
            <ActionForm action={addStopsAction} submit="Add to route">
              <input type="hidden" name="route_id" value={id} />
              <select name="stop_type" className="field"><option value="delivery">As delivery stops</option><option value="pickup">As pickup stops</option></select>
              <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-beige p-2">
                {(candidates ?? []).filter((c) => !inRoute.has(c.id)).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-beige/40">
                    <input type="checkbox" name="shipment_ids" value={c.id} /> <span className="font-mono">{c.tracking_number}</span> <span className="text-muted">{c.pickup_city} → {c.delivery_city}</span>
                  </label>
                ))}
              </div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
