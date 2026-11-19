import { DashTitle } from "@/components/dashboard/Shell";
import { EmptyState, StatusBadge } from "@/components/ui";
import { requireDriverPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export default async function History() {
  const u = await requireDriverPage();
  const { data } = await createAdminClient()
    .from("shipment_events")
    .select("id, status, created_at, pod_recipient_name, shipments(tracking_number, delivery_city)")
    .eq("actor_profile_id", u.id)
    .in("status", ["delivered", "delivery_attempted", "picked_up", "exception"])
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <>
      <DashTitle title="Delivery history" sub="Pickups, deliveries and attempts you recorded." />
      {!data?.length ? <EmptyState title="No history yet" /> : (
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>When</th><th>Tracking</th><th>Event</th><th>City</th><th>Received by</th></tr></thead>
          <tbody>{data.map((e) => { const s = e.shipments as unknown as { tracking_number: string; delivery_city: string }; return (
            <tr key={e.id}><td className="whitespace-nowrap">{new Date(e.created_at).toLocaleString("en-CA")}</td><td className="font-mono">{s?.tracking_number}</td><td><StatusBadge status={e.status} /></td><td>{s?.delivery_city}</td><td>{e.pod_recipient_name ?? "—"}</td></tr>
          ); })}</tbody>
        </table></div>
      )}
    </>
  );
}
