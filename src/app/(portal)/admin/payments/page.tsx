import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, EmptyState, Stat } from "@/components/ui";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function Payments({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaffPage("payments.view");
  const { status } = await searchParams;
  const a = createAdminClient();
  let q = a.from("payments").select("*, shipments(id, tracking_number)").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const [{ data }, { data: refunds }] = await Promise.all([q, a.from("refunds").select("amount_cents, status")]);
  const paid = (data ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_cents, 0);
  const refunded = (refunds ?? []).filter((r) => r.status !== "failed").reduce((s, r) => s + r.amount_cents, 0);
  return (
    <>
      <DashTitle title="Payments" sub="Card payments are marked paid only by the verified Stripe webhook. Offline invoice payments are recorded with an audit trail." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Paid (listed)" value={formatCents(paid)} />
        <Stat label="Refunded (all time)" value={formatCents(refunded)} />
        <Stat label="Failed (listed)" value={(data ?? []).filter((p) => p.status === "failed").length} />
        <Stat label="Pending (listed)" value={(data ?? []).filter((p) => p.status === "pending").length} />
      </div>
      <div className="mb-3 flex flex-wrap gap-1 text-sm">{["", "paid", "pending", "failed", "refunded", "partially_refunded"].map((s) => <a key={s} href={s ? `?status=${s}` : "?"} className={`rounded-md px-3 py-1.5 font-semibold ${s === (status ?? "") ? "bg-charcoal text-ivory" : "bg-white"}`}>{s || "all"}</a>)}</div>
      {!data?.length ? <EmptyState title="No payments" /> : (
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>Date</th><th>Shipment</th><th>Provider</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
          <tbody>{data.map((p) => { const s = p.shipments as unknown as { id: string; tracking_number: string } | null; return (
            <tr key={p.id}><td className="whitespace-nowrap">{new Date(p.paid_at ?? p.created_at).toLocaleString("en-CA")}</td><td>{s ? <Link className="font-mono underline" href={`/admin/shipments/${s.id}`}>{s.tracking_number}</Link> : p.invoice_id ? "Invoice" : "—"}</td><td>{p.provider}</td><td>{formatCents(p.amount_cents)}</td><td><Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "warning"}>{p.status}</Badge>{p.failure_reason && <span className="block text-xs text-muted">{p.failure_reason}</span>}</td><td>{p.receipt_number && p.shipment_id ? <a className="underline" target="_blank" href={`/api/receipts/${p.id}`}>{p.receipt_number}</a> : p.receipt_number ?? "—"}</td></tr>
          ); })}</tbody>
        </table></div>
      )}
      <p className="mt-3 text-xs text-muted">Refunds are issued from each shipment&apos;s page.</p>
    </>
  );
}
