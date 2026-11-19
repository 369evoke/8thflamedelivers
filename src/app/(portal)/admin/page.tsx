import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Card, Stat } from "@/components/ui";
import { BarChart } from "@/components/dashboard/BarChart";
import { createAdminClient } from "@/lib/supabase/server";
import { requireStaffPage } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { formatCents } from "@/lib/pricing";
import { ACTIVE_STATUSES } from "@/lib/status";
import { dailySeries, groupBy, isoWeek } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const u = await requireStaffPage();
  const finance = hasPermission(u.role, "reports.view") || hasPermission(u.role, "payments.view");
  const a = createAdminClient();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const c = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const real = ["paid", "invoiced", "refunded", "partially_refunded"];
  const [total, todayCount, active, completed, pendingPickups, delayed, exceptions, approvedDrivers, pendingApps, businesses, pendingPay, revenue, series] = await Promise.all([
    c(a.from("shipments").select("id", { count: "exact", head: true }).in("payment_status", real)),
    c(a.from("shipments").select("id", { count: "exact", head: true }).in("payment_status", real).gte("created_at", today.toISOString())),
    c(a.from("shipments").select("id", { count: "exact", head: true }).in("status", ACTIVE_STATUSES).in("payment_status", real)),
    c(a.from("shipments").select("id", { count: "exact", head: true }).eq("status", "delivered")),
    c(a.from("shipments").select("id", { count: "exact", head: true }).in("status", ["confirmed", "pickup_scheduled", "driver_assigned", "driver_en_route_pickup"])),
    c(a.from("shipments").select("id", { count: "exact", head: true }).in("status", ["delayed", "delivery_attempted"])),
    c(a.from("shipments").select("id", { count: "exact", head: true }).eq("status", "exception")),
    c(a.from("drivers").select("id", { count: "exact", head: true }).eq("status", "approved")),
    c(a.from("driver_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"])),
    c(a.from("businesses").select("id", { count: "exact", head: true }).eq("status", "approved")),
    finance ? a.from("invoices").select("total_cents").in("status", ["issued", "overdue"]).then((r) => (r.data ?? []).reduce((s, x) => s + x.total_cents, 0)) : Promise.resolve(0),
    finance ? a.from("payments").select("amount_cents").eq("status", "paid").then((r) => (r.data ?? []).reduce((s, x) => s + x.amount_cents, 0)) : Promise.resolve(0),
    dailySeries(56),
  ]);
  const last14 = series.slice(-14).map((d) => ({ label: d.day.slice(5), value: Number(d.shipments) }));
  const weekly = groupBy(series, (d) => isoWeek(d.day), (d) => Number(d.shipments));

  return (
    <>
      <DashTitle title="Operations overview" sub="Live figures from the shipment database." actions={<Link href="/dispatch" className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-ivory">Open dispatch</Link>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total shipments" value={total} />
        <Stat label="Today" value={todayCount} />
        <Stat label="Active" value={active} />
        <Stat label="Delivered" value={completed} />
        <Stat label="Pending pickups" value={pendingPickups} />
        <Stat label="Delayed" value={delayed} />
        <Stat label="Exceptions" value={exceptions} />
        {finance && <Stat label="Card revenue (paid)" value={formatCents(revenue)} />}
        {finance && <Stat label="Outstanding invoices" value={formatCents(pendingPay)} />}
        <Stat label="Approved drivers" value={approvedDrivers} />
        <Stat label="Pending driver apps" value={pendingApps} />
        <Stat label="Business accounts" value={businesses} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card><h2 className="mb-4 font-bold">Daily shipments (14 days)</h2><BarChart data={last14} label="Daily shipments" /></Card>
        <Card><h2 className="mb-4 font-bold">Weekly shipments (8 weeks)</h2><BarChart data={weekly} label="Weekly shipments" /></Card>
      </div>
      <p className="mt-4 text-sm"><Link href="/admin/reports" className="font-semibold text-gold-dark underline">Full reports & analytics →</Link></p>
    </>
  );
}
