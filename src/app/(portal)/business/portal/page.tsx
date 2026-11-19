import { DashTitle } from "@/components/dashboard/Shell";
import { ButtonLink, Stat } from "@/components/ui";
import { ShipmentTable, SHIPMENT_LIST_COLUMNS } from "@/components/dashboard/ShipmentTable";
import { requireBusinessPage } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/pricing";
import { ACTIVE_STATUSES } from "@/lib/status";

export default async function BizHome() {
  const { business } = await requireBusinessPage();
  const db = await createUserClient(); // RLS: members only see their business's shipments
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [{ data: all }, { data: recent }] = await Promise.all([
    db.from("shipments").select("status, total_cents, created_at, payment_status").eq("business_id", business.id),
    db.from("shipments").select(SHIPMENT_LIST_COLUMNS).eq("business_id", business.id).order("created_at", { ascending: false }).limit(8),
  ]);
  const rows = (all ?? []).filter((r) => ["paid", "invoiced", "refunded", "partially_refunded"].includes(r.payment_status));
  const month = rows.filter((r) => r.created_at >= monthStart.toISOString());
  return (
    <>
      <DashTitle title="Business overview" actions={<><ButtonLink href="/business/portal/create">Create shipment</ButtonLink><ButtonLink href="/business/portal/bulk" variant="outline">Bulk upload</ButtonLink></>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total shipments" value={rows.length} />
        <Stat label="Active" value={rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).length} />
        <Stat label="Shipments this month" value={month.length} />
        <Stat label="Shipping expenses this month" value={formatCents(month.reduce((s, r) => s + r.total_cents, 0))} />
      </div>
      <h2 className="mb-3 mt-8 font-bold">Recent shipments</h2>
      <ShipmentTable rows={recent ?? []} base="/business/portal/shipments" />
    </>
  );
}
