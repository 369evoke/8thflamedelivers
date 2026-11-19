import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, Card, EmptyState } from "@/components/ui";
import { requireDriverPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { mapsLink } from "@/lib/driver-data";

export default async function DriverRoutes() {
  const u = await requireDriverPage();
  const { data: routes } = await createAdminClient()
    .from("delivery_routes")
    .select("id, name, route_date, status, notes, route_stops(id, sequence, stop_type, completed_at, shipments(id, tracking_number, pickup_street, pickup_city, delivery_street, delivery_city, recipient_name))")
    .eq("driver_id", u.driverId!)
    .in("status", ["planned", "active"])
    .order("route_date");
  return (
    <>
      <DashTitle title="My routes" />
      {!routes?.length ? <EmptyState title="No routes assigned" body="Dispatch will add routes here." /> : (
        <div className="space-y-6">
          {routes.map((r) => {
            const stops = [...(r.route_stops ?? [])].sort((a, b) => a.sequence - b.sequence);
            const addrs = stops.map((st) => { const s = st.shipments as unknown as Record<string, string>; return st.stop_type === "pickup" ? `${s.pickup_street}, ${s.pickup_city}` : `${s.delivery_street}, ${s.delivery_city}`; });
            const full = addrs.length ? `https://www.google.com/maps/dir/${addrs.map(encodeURIComponent).join("/")}` : null;
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{r.name}</h2><span className="text-sm text-muted">{r.route_date} · <Badge tone="gold">{r.status}</Badge></span></div>
                {r.notes && <p className="mt-1 text-sm text-muted">{r.notes}</p>}
                <ol className="mt-4 space-y-2">
                  {stops.map((st, i) => {
                    const s = st.shipments as unknown as Record<string, string>;
                    return (
                      <li key={st.id} className={`flex items-start gap-3 rounded-lg border border-beige p-3 text-sm ${st.completed_at ? "opacity-50" : ""}`}>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-charcoal text-xs font-bold text-ivory">{st.sequence}</span>
                        <div className="flex-1"><p className="font-semibold capitalize">{st.stop_type}: {addrs[i]}</p><Link href={`/driver/shipments/${s.id}`} className="font-mono text-xs underline">{s.tracking_number}</Link></div>
                        <a href={mapsLink(addrs[i])} target="_blank" className="text-xs font-semibold text-gold-dark">Go</a>
                      </li>
                    );
                  })}
                </ol>
                {full && <a href={full} target="_blank" className="mt-4 inline-block rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-ivory">Open full route in Maps</a>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
