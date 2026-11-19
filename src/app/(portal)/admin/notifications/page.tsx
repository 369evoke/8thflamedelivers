import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, EmptyState, Alert } from "@/components/ui";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { integrations } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Notifications({ searchParams }: { searchParams: Promise<{ audience?: string }> }) {
  await requireStaffPage("audit.view");
  const { audience } = await searchParams;
  let q = createAdminClient().from("notifications").select("id, audience, template, subject, recipient_email, delivery_status, error, created_at").order("created_at", { ascending: false }).limit(300);
  if (audience) q = q.eq("audience", audience);
  const { data } = await q;
  return (
    <>
      <DashTitle title="Notifications" sub="Every email the platform sends is logged here. SMS is reserved for a future integration." />
      {!integrations.email() && <div className="mb-4"><Alert tone="warning">RESEND_API_KEY isn&apos;t set, so emails are logged as <strong>skipped</strong> and not delivered.</Alert></div>}
      <div className="mb-3 flex flex-wrap gap-1 text-sm">{["", "customer", "driver", "business", "staff"].map((s) => <a key={s} href={s ? `?audience=${s}` : "?"} className={`rounded-md px-3 py-1.5 font-semibold ${s === (audience ?? "") ? "bg-charcoal text-ivory" : "bg-white"}`}>{s || "all"}</a>)}</div>
      {!data?.length ? <EmptyState title="No notifications sent yet" /> : (
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>When</th><th>Audience</th><th>Subject</th><th>To</th><th>Delivery</th></tr></thead>
          <tbody>{data.map((n) => <tr key={n.id}><td className="whitespace-nowrap">{new Date(n.created_at).toLocaleString("en-CA")}</td><td>{n.audience}</td><td>{n.subject}<span className="block text-xs text-muted">{n.template}</span></td><td>{n.recipient_email ?? "—"}</td><td><Badge tone={n.delivery_status === "sent" ? "success" : n.delivery_status === "failed" ? "danger" : "neutral"}>{n.delivery_status}</Badge>{n.error && <span className="block text-xs text-danger">{n.error}</span>}</td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}
