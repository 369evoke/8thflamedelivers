import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { upsertPromoAction } from "@/app/actions/admin";

type Promo = { code: string; description: string | null; percent_off: number | null; amount_off_cents: number | null; max_redemptions: number | null; times_redeemed: number; valid_from: string | null; valid_until: string | null; is_active: boolean };

function PromoForm({ p }: { p?: Promo }) {
  return (
    <ActionForm action={upsertPromoAction} submit={p ? "Save" : "Create promo"} className="grid gap-2 sm:grid-cols-4">
      <label className="text-xs">Code<input name="code" defaultValue={p?.code} readOnly={!!p} className="field uppercase" required /></label>
      <label className="text-xs sm:col-span-3">Description<input name="description" defaultValue={p?.description ?? ""} className="field" /></label>
      <label className="text-xs">% off<input name="percent_off" type="number" step="0.5" min="0" max="100" defaultValue={p?.percent_off ?? ""} className="field" /></label>
      <label className="text-xs">$ off<input name="amount_off" type="number" step="0.01" min="0" defaultValue={p?.amount_off_cents != null ? (p.amount_off_cents / 100).toFixed(2) : ""} className="field" /></label>
      <label className="text-xs">Max uses<input name="max_redemptions" type="number" min="1" defaultValue={p?.max_redemptions ?? ""} className="field" /></label>
      <p className="self-end pb-3 text-xs text-muted">{p ? `Used ${p.times_redeemed}×` : ""}</p>
      <label className="text-xs">Valid from<input name="valid_from" type="date" defaultValue={p?.valid_from?.slice(0, 10) ?? ""} className="field" /></label>
      <label className="text-xs">Valid until<input name="valid_until" type="date" defaultValue={p?.valid_until?.slice(0, 10) ?? ""} className="field" /></label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="is_active" defaultChecked={p ? p.is_active : true} /> Active</label>
    </ActionForm>
  );
}

export default async function Discounts() {
  await requireStaffPage("promos.manage");
  const { data } = await createAdminClient().from("promo_codes").select("*").order("created_at", { ascending: false });
  return (
    <>
      <DashTitle title="Discounts & promo codes" sub="Promotional discounts apply after business account discounts. Business discounts are set per account." />
      <div className="space-y-4">
        <Card className="border-dashed p-5"><h2 className="mb-3 font-bold">New promo code</h2><PromoForm /></Card>
        {(data as Promo[] | null)?.map((p) => <Card key={p.code} className="p-5"><PromoForm p={p} /></Card>)}
      </div>
    </>
  );
}
