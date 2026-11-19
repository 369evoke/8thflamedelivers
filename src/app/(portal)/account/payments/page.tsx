import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/pricing";

export default async function Payments() {
  const u = await requireUser();
  const db = await createUserClient();
  const { data } = await db.from("payments").select("id, amount_cents, status, receipt_number, paid_at, created_at, shipment_id, shipments(tracking_number)").eq("profile_id", u.id).order("created_at", { ascending: false });
  return (
    <>
      <DashTitle title="Payment history & receipts" />
      {!data?.length ? <EmptyState title="No payments yet" /> : (
        <div className="overflow-x-auto rounded-xl border border-beige bg-white">
          <table className="table">
            <thead><tr><th>Date</th><th>Shipment</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
            <tbody>
              {data.map((p) => {
                const tn = (p.shipments as unknown as { tracking_number: string } | null)?.tracking_number;
                return (
                  <tr key={p.id}>
                    <td>{new Date(p.paid_at ?? p.created_at).toLocaleDateString("en-CA")}</td>
                    <td>{tn ? <Link className="font-mono underline" href={`/account/shipments/${p.shipment_id}`}>{tn}</Link> : "—"}</td>
                    <td>{formatCents(p.amount_cents)}</td>
                    <td><Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "warning"}>{p.status}</Badge></td>
                    <td>{["paid", "refunded", "partially_refunded"].includes(p.status) ? <a className="font-semibold text-gold-dark underline" href={`/api/receipts/${p.id}`} target="_blank">{p.receipt_number} (PDF)</a> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
