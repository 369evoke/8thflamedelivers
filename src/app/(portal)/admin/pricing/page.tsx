import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { deletePricingRuleAction, upsertPricingRuleAction } from "@/app/actions/admin";

export default async function Pricing() {
  await requireStaffPage("pricing.manage");
  const { data } = await createAdminClient().from("pricing_rules").select("*").order("rule_type").order("key");
  const rows = data ?? [];
  const Section = ({ type, title, hint, valueField }: { type: string; title: string; hint: string; valueField: "percent" | "amount" | "numeric_value" }) => (
    <Card className="p-5">
      <h2 className="font-bold">{title}</h2><p className="mb-4 text-xs text-muted">{hint}</p>
      <div className="space-y-2">
        {rows.filter((r) => r.rule_type === type).map((r) => (
          <div key={r.id} className="flex flex-wrap items-end gap-2">
            <ActionForm action={upsertPricingRuleAction} submit="Save" variant="outline" className="flex flex-1 flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="rule_type" value={type} />
              <input name="key" defaultValue={r.key} className="field !w-28" aria-label="Key" />
              <input name="label" defaultValue={r.label} className="field !w-56" aria-label="Label" />
              <input name={valueField} type="number" step="0.001" defaultValue={valueField === "amount" ? ((r.amount_cents ?? 0) / 100).toFixed(2) : String(r[valueField] ?? "")} className="field !w-28" aria-label="Value" />
            </ActionForm>
            <form action={deletePricingRuleAction}><input type="hidden" name="id" value={r.id} /><button className="pb-3 text-xs text-danger">Delete</button></form>
          </div>
        ))}
        {type !== "dim_divisor" && (
          <ActionForm action={upsertPricingRuleAction} submit="Add" className="flex flex-wrap items-end gap-2 border-t border-beige pt-3" resetOnSuccess>
            <input type="hidden" name="rule_type" value={type} />
            <input name="key" placeholder={type === "tax" ? "ON" : "code"} className="field !w-28" required />
            <input name="label" placeholder="Label" className="field !w-56" required />
            <input name={valueField} type="number" step="0.001" placeholder={valueField === "amount" ? "$" : "%"} className="field !w-28" required />
          </ActionForm>
        )}
      </div>
    </Card>
  );
  return (
    <>
      <DashTitle title="Pricing management" sub="All calculations run on the server from these values. Base, per-km, per-kg, minimum and same-day charges are per service (Shipping Services). Business discounts are per account; promotional discounts under Discounts." />
      <div className="space-y-5">
        <Section type="tax" title="Taxes by pickup province" hint="Percent applied after discounts. Verify rates with your accountant." valueField="percent" />
        <Section type="handling_fee" title="Additional handling fees" hint="Flat fee per package flagged with this handling code (fragile, signature_required, oversized, keep_upright)." valueField="amount" />
        <Section type="dim_divisor" title="Dimensional weight" hint="Billable weight = max(actual, L×W×H ÷ divisor). 5000 is common for courier services." valueField="numeric_value" />
      </div>
      <p className="mt-4 text-sm text-muted">Location-specific pricing: set a price multiplier on each service area, and an intercity surcharge on each lane.</p>
    </>
  );
}
