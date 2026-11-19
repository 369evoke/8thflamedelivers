import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { reviewBusinessAction } from "@/app/actions/admin";
import { formatCents } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function Businesses() {
  await requireStaffPage("businesses.manage");
  const a = createAdminClient();
  const [{ data }, { data: ships }] = await Promise.all([
    a.from("businesses").select("*, business_members(id)").order("created_at", { ascending: false }),
    a.from("shipments").select("business_id, total_cents").not("business_id", "is", null).in("payment_status", ["paid", "invoiced"]),
  ]);
  const spend = new Map<string, { n: number; c: number }>(); (ships ?? []).forEach((s) => { const x = spend.get(s.business_id) ?? { n: 0, c: 0 }; x.n++; x.c += s.total_cents; spend.set(s.business_id, x); });
  return (
    <>
      <DashTitle title="Business accounts" sub="Approve applications and set negotiated discounts and invoicing terms." />
      {!data?.length ? <EmptyState title="No business accounts yet" /> : (
        <div className="space-y-4">
          {data.map((b) => (
            <Card key={b.id} className="grid gap-5 p-6 lg:grid-cols-[1.3fr_1fr]">
              <div className="text-sm">
                <div className="flex items-center gap-2"><h2 className="text-lg font-bold">{b.name}</h2><Badge tone={b.status === "approved" ? "success" : b.status === "rejected" || b.status === "suspended" ? "danger" : "gold"}>{b.status.replace("_", " ")}</Badge></div>
                <p className="text-muted">{b.contact_name} · {b.email} · {b.phone}</p>
                <p>{b.address}, {b.city} {b.province} · {b.business_type}</p>
                <p>Estimated volume: {b.estimated_monthly_volume}/month · Team members: {b.business_members?.length ?? 0}</p>
                <p className="mt-2 font-semibold">Activity: {spend.get(b.id)?.n ?? 0} shipments · {formatCents(spend.get(b.id)?.c ?? 0)}</p>
              </div>
              <ActionForm action={reviewBusinessAction} submit="Save">
                <input type="hidden" name="id" value={b.id} />
                <select name="status" defaultValue={b.status} className="field">{["submitted", "under_review", "approved", "rejected", "suspended"].map((s) => <option key={s}>{s}</option>)}</select>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">Discount %<input name="discount_percent" type="number" step="0.5" min="0" max="90" defaultValue={b.discount_percent} className="field" /></label>
                  <label className="text-xs">Payment terms (days)<input name="payment_terms_days" type="number" min="0" max="120" defaultValue={b.payment_terms_days} className="field" /></label>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="invoicing_enabled" defaultChecked={b.invoicing_enabled} /> Allow invoice billing</label>
                <textarea name="reviewer_notes" rows={2} defaultValue={b.reviewer_notes ?? ""} placeholder="Internal notes" className="field" />
              </ActionForm>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
