import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, EmptyState } from "@/components/ui";
import { requireBusinessPage } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/pricing";

export default async function Invoices() {
  const { business } = await requireBusinessPage();
  const db = await createUserClient(); // RLS: business owners/admins only
  const { data } = await db.from("invoices").select("*").eq("business_id", business.id).order("created_at", { ascending: false });
  return (
    <>
      <DashTitle title="Invoices" />
      {!["owner", "admin"].includes(business.member_role) ? <EmptyState title="Invoices are visible to business owners and admins." /> : !data?.length ? <EmptyState title="No invoices yet" /> : (
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>Invoice</th><th>Period</th><th>Total</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>{data.map((i) => <tr key={i.id}><td><a className="font-mono underline" href={`/api/invoices/${i.id}`} target="_blank">{i.invoice_number}</a></td><td>{i.period_start} → {i.period_end}</td><td>{formatCents(i.total_cents)}</td><td>{i.due_date}</td><td><Badge tone={i.status === "paid" ? "success" : "gold"}>{i.status}</Badge></td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}
