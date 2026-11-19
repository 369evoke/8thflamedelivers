import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, Card, EmptyState, Stat, StatusBadge } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/server";
import { approvedDrivers } from "@/lib/ops-data";
import type { ShipmentStatus } from "@/lib/status";

export const dynamic = "force-dynamic";
const COLS = "id, tracking_number, status, pickup_city, delivery_city, pickup_date, pickup_window, package_count, service_code, created_at, shipment_assignments(is_active)";
type Row = { id: string; tracking_number: string; status: ShipmentStatus; pickup_city: string; delivery_city: string; pickup_date: string; pickup_window: string; package_count: number; service_code: string; created_at: string; shipment_assignments: { is_active: boolean }[] };

export default async function DispatchBoard() {
  const admin = createAdminClient();
  const paid = ["paid", "invoiced"];
  const [incoming, awaitingPickup, active, delayed, exceptions, drivers] = await Promise.all([
    admin.from("shipments").select(COLS).eq("status", "awaiting_confirmation").in("payment_status", paid).order("created_at"),
    admin.from("shipments").select(COLS).in("status", ["confirmed", "pickup_scheduled", "driver_assigned", "driver_en_route_pickup"]).order("pickup_date"),
    admin.from("shipments").select(COLS).in("status", ["picked_up", "at_processing_facility", "in_transit", "at_destination_facility", "out_for_delivery"]).order("updated_at", { ascending: false }).limit(50),
    admin.from("shipments").select(COLS).in("status", ["delayed", "delivery_attempted"]).order("updated_at", { ascending: false }),
    admin.from("shipments").select(COLS).eq("status", "exception").order("updated_at", { ascending: false }),
    approvedDrivers(),
  ]);
  const ap = (awaitingPickup.data ?? []) as Row[];
  const pendingAssign = ap.filter((r) => !r.shipment_assignments.some((a) => a.is_active));

  const Lane = ({ title, rows, tone }: { title: string; rows: Row[]; tone?: "warning" | "danger" }) => (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-bold">{title} <Badge tone={tone ?? "neutral"}>{rows.length}</Badge></h2>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} href={`/admin/shipments/${r.id}`} className="block rounded-lg border border-beige bg-white p-3 text-sm hover:border-gold">
              <div className="flex items-center justify-between gap-2"><span className="font-mono font-semibold">{r.tracking_number}</span><StatusBadge status={r.status} /></div>
              <p className="mt-1">{r.pickup_city} → {r.delivery_city} · {r.package_count} pkg · {r.service_code.replace("_", " ")}</p>
              <p className="text-xs text-muted">Pickup {r.pickup_date} {r.pickup_window}{!r.shipment_assignments.some((a) => a.is_active) && " · unassigned"}</p>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="Nothing here" />}
    </section>
  );

  return (
    <>
      <DashTitle title="Dispatch board" sub="Review, confirm, schedule and assign. Click a shipment to act on it." actions={<Link href="/dispatch/routes" className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-ivory">Plan routes</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Incoming" value={incoming.data?.length ?? 0} />
        <Stat label="Awaiting pickup" value={ap.length} />
        <Stat label="Pending assignment" value={pendingAssign.length} />
        <Stat label="Active deliveries" value={active.data?.length ?? 0} />
        <Stat label="Delayed / attempted" value={delayed.data?.length ?? 0} />
        <Stat label="Exceptions" value={exceptions.data?.length ?? 0} />
      </div>
      <div className="mt-8 grid gap-8 xl:grid-cols-3">
        <Lane title="Incoming — review & confirm" rows={(incoming.data ?? []) as Row[]} />
        <Lane title="Pending assignment" rows={pendingAssign} />
        <Lane title="Awaiting pickup (assigned)" rows={ap.filter((r) => !pendingAssign.includes(r))} />
        <Lane title="Active deliveries" rows={(active.data ?? []) as Row[]} />
        <Lane title="Delayed & failed attempts" rows={(delayed.data ?? []) as Row[]} tone="warning" />
        <Lane title="Exceptions" rows={(exceptions.data ?? []) as Row[]} tone="danger" />
      </div>
      <h2 className="mb-3 mt-10 font-bold">Approved drivers</h2>
      {drivers.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {drivers.map((d) => (
            <Card key={d.id} className="text-sm">
              <div className="flex items-center justify-between"><p className="font-semibold">{d.name}</p><Badge tone={d.available ? "success" : "neutral"}>{d.available ? "Available" : "Off"}</Badge></div>
              <p className="text-muted">{d.vehicle ?? "—"}{d.area && ` · ${d.area}`}</p>
              <p className="mt-1">{d.active} active assignment{d.active === 1 ? "" : "s"}</p>
            </Card>
          ))}
        </div>
      ) : <EmptyState title="No approved drivers" body="Approve driver applications in Admin → Driver Applications." />}
    </>
  );
}
