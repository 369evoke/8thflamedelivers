import { DashTitle } from "@/components/dashboard/Shell";
import { EmptyState } from "@/components/ui";
import { requireBusinessPage } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";

export default async function Labels() {
  const { business } = await requireBusinessPage();
  const db = await createUserClient();
  const { data } = await db.from("shipments").select("id, tracking_number, recipient_name, delivery_city, package_count, created_at").eq("business_id", business.id).in("payment_status", ["paid", "invoiced"]).in("status", ["awaiting_confirmation", "confirmed", "pickup_scheduled", "driver_assigned", "driver_en_route_pickup"]).order("created_at", { ascending: false });
  return (
    <>
      <DashTitle title="Shipping labels" sub="Shipments awaiting pickup. Print one label per package." />
      {!data?.length ? <EmptyState title="No shipments awaiting pickup" /> : (
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>Tracking</th><th>Recipient</th><th>Packages</th><th>Print</th></tr></thead>
          <tbody>{data.map((s) => <tr key={s.id}><td className="font-mono">{s.tracking_number}</td><td>{s.recipient_name}, {s.delivery_city}</td><td>{s.package_count}</td><td className="space-x-3"><a className="font-semibold underline" href={`/api/labels/${s.id}`} target="_blank">4×6 thermal</a><a className="font-semibold underline" href={`/api/labels/${s.id}?format=letter`} target="_blank">Letter</a></td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}
