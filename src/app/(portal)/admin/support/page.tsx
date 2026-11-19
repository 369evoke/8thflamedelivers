import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, EmptyState } from "@/components/ui";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupportList({ searchParams }: { searchParams: Promise<{ status?: string; mine?: string }> }) {
  const u = await requireStaffPage("support.manage");
  const { status = "active", mine } = await searchParams;
  let q = createAdminClient().from("support_tickets").select("id, ticket_number, subject, category, status, priority, contact_email, updated_at, assigned_to, profiles:assigned_to(full_name)").order("updated_at", { ascending: false }).limit(200);
  q = status === "active" ? q.in("status", ["open", "in_progress", "waiting_on_customer"]) : q.eq("status", status);
  if (mine) q = q.eq("assigned_to", u.id);
  const { data } = await q;
  return (
    <>
      <DashTitle title="Customer support" actions={<div className="flex flex-wrap gap-1 text-sm">{["active", "resolved", "closed"].map((s) => <a key={s} href={`?status=${s}`} className={`rounded-md px-3 py-1.5 font-semibold ${s === status && !mine ? "bg-charcoal text-ivory" : "bg-white"}`}>{s}</a>)}<a href="?mine=1" className={`rounded-md px-3 py-1.5 font-semibold ${mine ? "bg-charcoal text-ivory" : "bg-white"}`}>assigned to me</a></div>} />
      {!data?.length ? <EmptyState title="No tickets" /> : (
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>Ticket</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Updated</th></tr></thead>
          <tbody>{data.map((t) => <tr key={t.id}><td><Link className="font-mono underline" href={`/admin/support/${t.id}`}>{t.ticket_number}</Link></td><td>{t.subject}<span className="block text-xs text-muted">{t.contact_email}</span></td><td>{t.category.replace(/_/g, " ")}</td><td><Badge tone={t.priority === "urgent" || t.priority === "high" ? "danger" : "neutral"}>{t.priority}</Badge></td><td>{t.status.replace(/_/g, " ")}</td><td>{(t.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}</td><td className="whitespace-nowrap">{new Date(t.updated_at).toLocaleString("en-CA")}</td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}
