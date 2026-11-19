import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { upsertServiceAction } from "@/app/actions/admin";

type Svc = Record<string, string | number | boolean | null>;
const d = (c: unknown) => (c == null ? "" : (Number(c) / 100).toFixed(2));

function ServiceForm({ s }: { s?: Svc }) {
  return (
    <ActionForm action={upsertServiceAction} submit={s ? "Save service" : "Add service"} className="grid gap-2 sm:grid-cols-4">
      <label className="text-xs">Code<input name="code" defaultValue={String(s?.code ?? "")} readOnly={!!s} className="field" required /></label>
      <label className="text-xs sm:col-span-3">Name<input name="name" defaultValue={String(s?.name ?? "")} className="field" required /></label>
      <label className="text-xs sm:col-span-4">Description<input name="description" defaultValue={String(s?.description ?? "")} className="field" /></label>
      <label className="text-xs">Base price $<input name="base_price" type="number" step="0.01" min="0" defaultValue={d(s?.base_price_cents)} className="field" /></label>
      <label className="text-xs">Per km $<input name="per_km" type="number" step="0.01" min="0" defaultValue={d(s?.per_km_cents)} className="field" /></label>
      <label className="text-xs">Per kg $ (over included)<input name="per_kg" type="number" step="0.01" min="0" defaultValue={d(s?.per_kg_cents)} className="field" /></label>
      <label className="text-xs">Included kg<input name="included_kg" type="number" step="0.1" min="0" defaultValue={String(s?.included_kg ?? 0)} className="field" /></label>
      <label className="text-xs">Minimum charge $<input name="min_charge" type="number" step="0.01" min="0" defaultValue={d(s?.min_charge_cents)} className="field" /></label>
      <label className="text-xs">Service surcharge $<input name="surcharge" type="number" step="0.01" min="0" defaultValue={d(s?.surcharge_cents)} className="field" /></label>
      <label className="text-xs">Max distance km<input name="max_distance_km" type="number" min="1" defaultValue={String(s?.max_distance_km ?? "")} className="field" /></label>
      <label className="text-xs">Transit days<input name="transit_days" type="number" min="0" defaultValue={String(s?.transit_days ?? 1)} className="field" /></label>
      <div className="flex flex-wrap gap-4 text-sm sm:col-span-4">
        <label className="flex items-center gap-1"><input type="checkbox" name="same_day" defaultChecked={!!s?.same_day} /> Same-day</label>
        <label className="flex items-center gap-1"><input type="checkbox" name="business_only" defaultChecked={!!s?.business_only} /> Business accounts only</label>
        <label className="flex items-center gap-1"><input type="checkbox" name="is_active" defaultChecked={s ? !!s.is_active : true} /> Active</label>
      </div>
    </ActionForm>
  );
}

export default async function Services() {
  await requireStaffPage("services.manage");
  const { data } = await createAdminClient().from("shipping_services").select("*").order("sort_order");
  return (
    <>
      <DashTitle title="Shipping services & rates" sub="Service-specific pricing. Same-day surcharges, scheduled rates and per-km/per-kg charges are set here. Which services run in which areas is set under Service Areas." />
      <div className="space-y-5">
        {data?.map((s) => <Card key={s.id} className="p-5"><ServiceForm s={s} /></Card>)}
        <Card className="border-dashed p-5"><h2 className="mb-3 font-bold">New service</h2><ServiceForm /></Card>
      </div>
    </>
  );
}
