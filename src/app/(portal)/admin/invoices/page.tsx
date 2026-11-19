import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { generateInvoiceAction, markInvoicePaidAction } from "@/app/actions/admin";
import { formatCents } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function Invoices() {
  await requireStaffPage("invoices.manage");
  const a = createAdminClient();
  const [{ data: inv }, { data: biz }] = await Promise.all([
    a.from("invoices").select("*, businesses(name)").order("created_at", { ascending: false }).limit(200),
    a.from("businesses").select("id, name").eq("status", "approved").eq("invoicing_enabled", true).order("name"),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const first = today.slice(0, 8) + "01";
  return (
    <>
      <DashTitle title="Invoices" sub="For approved business accounts billed on terms." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {!inv?.length ? <EmptyState title="No invoices yet" /> : (
            <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
              <thead><tr><th>Invoice</th><th>Business</th><th>Period</th><th>Total</th><th>Due</th><th>Status</th><th /></tr></thead>
              <tbody>{inv.map((i) => { const overdue = i.status === "issued" && i.due_date && i.due_date < today; return (
                <tr key={i.id}>
                  <td className="font-mono"><a className="underline" target="_blank" href={`/api/invoices/${i.id}`}>{i.invoice_number}</a></td><td>{(i.businesses as unknown as { name: string })?.name}</td><td className="whitespace-nowrap">{i.period_start} → {i.period_end}</td><td>{formatCents(i.total_cents)}</td><td>{i.due_date}</td>
                  <td><Badge tone={i.status === "paid" ? "success" : overdue ? "danger" : "gold"}>{overdue ? "overdue" : i.status}</Badge>{i.payment_reference && <span className="block text-xs text-muted">Ref {i.payment_reference}</span>}</td>
                  <td>{["issued", "overdue"].includes(i.status) && <ActionForm action={markInvoicePaidAction} submit="Mark paid" variant="outline" className="flex gap-1" confirm="Record this offline payment? This is logged."><input type="hidden" name="id" value={i.id} /><input name="reference" placeholder="Ref #" className="field !w-24 !py-1" required /></ActionForm>}</td>
                </tr>
              ); })}</tbody>
            </table></div>
          )}
        </div>
        <Card>
          <h2 className="mb-3 font-bold">Generate invoice</h2>
          {!biz?.length ? <p className="text-sm text-muted">No businesses have invoicing enabled.</p> : (
            <ActionForm action={generateInvoiceAction} submit="Generate & email">
              <select name="business_id" className="field">{biz.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              <label className="text-xs">From<input type="date" name="period_start" defaultValue={first} className="field" /></label>
              <label className="text-xs">To<input type="date" name="period_end" defaultValue={today} className="field" /></label>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}
