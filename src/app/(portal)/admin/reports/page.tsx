import { DashTitle } from "@/components/dashboard/Shell";
import { Card, Stat } from "@/components/ui";
import { BarChart } from "@/components/dashboard/BarChart";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/pricing";
import { dailySeries, groupBy } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function Reports() {
  await requireStaffPage("reports.view");
  const a = createAdminClient();
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const [series, { data: ships }, { data: audit }] = await Promise.all([
    dailySeries(180),
    a.from("shipments").select("service_code, status, total_cents, business_id, created_at, delivered_at, estimated_delivery_date, businesses(name)").gte("created_at", since).in("payment_status", ["paid", "invoiced", "refunded", "partially_refunded"]),
    a.from("audit_logs").select("id, action, entity_type, entity_id, actor_role, created_at, profiles:actor_profile_id(full_name)").order("created_at", { ascending: false }).limit(40),
  ]);
  const monthly = groupBy(series, (d) => d.day.slice(0, 7), (d) => Number(d.revenue_cents));
  const rows = ships ?? [];
  const finished = rows.filter((r) => ["delivered", "returned_to_sender", "cancelled"].includes(r.status));
  const delivered = rows.filter((r) => r.status === "delivered");
  const onTime = delivered.filter((r) => r.estimated_delivery_date && r.delivered_at && r.delivered_at.slice(0, 10) <= r.estimated_delivery_date);
  const svc = new Map<string, { n: number; d: number; ot: number; rev: number }>();
  rows.forEach((r) => {
    const s = svc.get(r.service_code) ?? { n: 0, d: 0, ot: 0, rev: 0 };
    s.n++; s.rev += r.total_cents;
    if (r.status === "delivered") { s.d++; if (r.estimated_delivery_date && r.delivered_at && r.delivered_at.slice(0, 10) <= r.estimated_delivery_date) s.ot++; }
    svc.set(r.service_code, s);
  });
  const biz = groupBy(rows.filter((r) => r.business_id), (r) => (r.businesses as unknown as { name: string })?.name ?? "—", (r) => r.total_cents).sort((x, y) => y.value - x.value).slice(0, 10);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <>
      <DashTitle title="Reports & analytics" sub="Last 90 days unless noted. Figures come directly from recorded shipments and payments." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Shipments (90d)" value={rows.length} />
        <Stat label="Completion rate" value={pct(delivered.length, finished.length)} hint="Delivered ÷ finished" />
        <Stat label="On-time rate" value={pct(onTime.length, delivered.length)} hint="Delivered by estimated date" />
        <Stat label="Revenue (90d)" value={formatCents(rows.reduce((s, r) => s + r.total_cents, 0))} hint="Paid + invoiced" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><h2 className="mb-4 font-bold">Monthly revenue (6 months)</h2><BarChart data={monthly} format={formatCents} label="Monthly revenue" /></Card>
        <Card><h2 className="mb-4 font-bold">Daily shipments (30 days)</h2><BarChart data={series.slice(-30).map((d) => ({ label: d.day.slice(5), value: Number(d.shipments) }))} label="Daily shipments" /></Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">Service performance</h2>
          <table className="table"><thead><tr><th>Service</th><th>Shipments</th><th>Delivered</th><th>On time</th><th>Revenue</th></tr></thead>
            <tbody>{[...svc.entries()].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.n}</td><td>{v.d}</td><td>{pct(v.ot, v.d)}</td><td>{formatCents(v.rev)}</td></tr>)}</tbody></table>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Business customer activity</h2>
          {biz.length ? <table className="table"><thead><tr><th>Business</th><th>Spend (90d)</th></tr></thead><tbody>{biz.map((b) => <tr key={b.label}><td>{b.label}</td><td>{formatCents(b.value)}</td></tr>)}</tbody></table> : <p className="text-sm text-muted">No business shipments yet.</p>}
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="mb-3 font-bold">Recent audit log</h2>
        <table className="table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th></tr></thead>
          <tbody>{audit?.map((l) => <tr key={l.id}><td className="whitespace-nowrap">{new Date(l.created_at).toLocaleString("en-CA")}</td><td>{(l.profiles as unknown as { full_name: string } | null)?.full_name ?? l.actor_role}</td><td>{l.action}</td><td className="font-mono text-xs">{l.entity_type} {l.entity_id?.slice(0, 8)}</td></tr>)}</tbody></table>
      </Card>
    </>
  );
}
