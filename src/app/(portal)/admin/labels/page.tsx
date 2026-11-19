import { DashTitle } from "@/components/dashboard/Shell";
import { EmptyState } from "@/components/ui";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export default async function Labels({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaffPage("shipments.view_all");
  const { q } = await searchParams;
  const a = createAdminClient();
  let sq = a.from("shipments").select("id, tracking_number, recipient_name, delivery_city, package_count, status").in("payment_status", ["paid", "invoiced"]).neq("status", "cancelled").order("created_at", { ascending: false }).limit(100);
  if (q) sq = sq.ilike("tracking_number", `%${q.replace(/[^A-Za-z0-9]/g, "")}%`);
  const [{ data }, { data: log }] = await Promise.all([sq, a.from("shipping_labels").select("shipment_id, format, created_at, profiles:generated_by(full_name)").order("created_at", { ascending: false }).limit(30)]);
  return (
    <>
      <DashTitle title="Shipping labels" sub="Generate 4×6 thermal or letter-size labels for any paid or invoiced shipment. Every generation is logged." />
      <form className="mb-4 flex max-w-sm gap-2"><input name="q" defaultValue={q} placeholder="Tracking number" className="field" /><button className="rounded-lg bg-charcoal px-3 text-sm font-semibold text-ivory">Find</button></form>
      {!data?.length ? <EmptyState title="No labelable shipments" /> : (
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>Tracking</th><th>Recipient</th><th>Packages</th><th>Labels</th></tr></thead>
          <tbody>{data.map((s) => <tr key={s.id}><td className="font-mono">{s.tracking_number}</td><td>{s.recipient_name}, {s.delivery_city}</td><td>{s.package_count}</td><td className="space-x-3"><a className="font-semibold underline" target="_blank" href={`/api/labels/${s.id}`}>4×6</a><a className="font-semibold underline" target="_blank" href={`/api/labels/${s.id}?format=letter`}>Letter</a></td></tr>)}</tbody>
        </table></div>
      )}
      <h2 className="mb-2 mt-8 font-bold">Recent label generations</h2>
      <ul className="text-sm text-muted">{log?.map((l, i) => <li key={i}>{new Date(l.created_at).toLocaleString("en-CA")} — {l.format} — {(l.profiles as unknown as { full_name: string } | null)?.full_name ?? "guest/customer"}</li>)}</ul>
    </>
  );
}
