import { DashTitle } from "@/components/dashboard/Shell";
import { ShipmentTable, SHIPMENT_LIST_COLUMNS } from "@/components/dashboard/ShipmentTable";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { SHIPMENT_STATUSES, STATUS_LABELS, isShipmentStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function AdminShipments({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string; pay?: string }> }) {
  await requireStaffPage("shipments.view_all");
  const sp = await searchParams;
  let q = createAdminClient().from("shipments").select(SHIPMENT_LIST_COLUMNS).order("created_at", { ascending: false }).limit(300);
  if (sp.q) { const t = sp.q.replace(/[^A-Za-z0-9-]/g, ""); q = q.or(`tracking_number.ilike.%${t}%,reference.ilike.%${t}%`); }
  if (sp.status && isShipmentStatus(sp.status)) q = q.eq("status", sp.status);
  if (sp.pay) q = q.eq("payment_status", sp.pay);
  if (sp.from) q = q.gte("created_at", sp.from);
  if (sp.to) q = q.lte("created_at", sp.to + "T23:59:59");
  const { data } = await q;
  return (
    <>
      <DashTitle title="Shipments" />
      <form className="mb-4 grid gap-2 rounded-xl border border-beige bg-white p-3 sm:grid-cols-6">
        <input name="q" defaultValue={sp.q} placeholder="Tracking # or reference" className="field sm:col-span-2" />
        <select name="status" defaultValue={sp.status ?? ""} className="field"><option value="">Any status</option>{SHIPMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select>
        <select name="pay" defaultValue={sp.pay ?? ""} className="field"><option value="">Any payment</option>{["unpaid", "pending", "paid", "failed", "invoiced", "refunded", "partially_refunded"].map((p) => <option key={p}>{p}</option>)}</select>
        <input type="date" name="from" defaultValue={sp.from} className="field" aria-label="From date" />
        <div className="flex gap-2"><input type="date" name="to" defaultValue={sp.to} className="field" aria-label="To date" /><button className="rounded-lg bg-charcoal px-3 text-sm font-semibold text-ivory">Filter</button></div>
      </form>
      <ShipmentTable rows={data ?? []} base="/admin/shipments" empty="No shipments match these filters." />
    </>
  );
}
