import { DashTitle } from "@/components/dashboard/Shell";
import { ShipmentTable, SHIPMENT_LIST_COLUMNS } from "@/components/dashboard/ShipmentTable";
import { requireBusinessPage } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";

export default async function History({ searchParams }: { searchParams: Promise<{ q?: string; from?: string; to?: string }> }) {
  const { business } = await requireBusinessPage();
  const sp = await searchParams;
  const db = await createUserClient();
  let q = db.from("shipments").select(SHIPMENT_LIST_COLUMNS).eq("business_id", business.id).order("created_at", { ascending: false }).limit(500);
  if (sp.q) q = q.ilike("tracking_number", `%${sp.q.replace(/[^A-Za-z0-9]/g, "")}%`);
  if (sp.from) q = q.gte("created_at", sp.from);
  if (sp.to) q = q.lte("created_at", sp.to + "T23:59:59");
  const { data } = await q;
  return (
    <>
      <DashTitle title="Shipment history" />
      <form className="mb-4 flex flex-wrap gap-2"><input name="q" defaultValue={sp.q} placeholder="Tracking #" className="field !w-48" /><input type="date" name="from" defaultValue={sp.from} className="field !w-40" /><input type="date" name="to" defaultValue={sp.to} className="field !w-40" /><button className="rounded-lg bg-charcoal px-3 text-sm font-semibold text-ivory">Filter</button></form>
      <ShipmentTable rows={data ?? []} base="/business/portal/shipments" />
    </>
  );
}
