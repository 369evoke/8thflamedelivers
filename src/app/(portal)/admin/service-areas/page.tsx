import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { upsertAreaAction, upsertLaneAction } from "@/app/actions/admin";
import { PROVINCES } from "@/lib/validation";

type Area = { id: string; name: string; city: string; province: string; postal_prefixes: string[]; zone: string; center_lat: number | null; center_lng: number | null; service_codes: string[]; price_multiplier: number; is_active: boolean };

export default async function Areas() {
  await requireStaffPage("areas.manage");
  const a = createAdminClient();
  const [{ data: areas }, { data: services }, { data: lanes }] = await Promise.all([
    a.from("service_areas").select("*").order("sort_order"),
    a.from("shipping_services").select("code, name"),
    a.from("area_routes").select("*"),
  ]);
  const name = new Map((areas ?? []).map((x) => [x.id, x.name]));
  const AreaForm = ({ x }: { x?: Area }) => (
    <ActionForm action={upsertAreaAction} submit={x ? "Save area" : "Add area"} className="grid gap-2 sm:grid-cols-6">
      {x && <input type="hidden" name="id" value={x.id} />}
      <label className="text-xs sm:col-span-2">Name<input name="name" defaultValue={x?.name} className="field" required /></label>
      <label className="text-xs sm:col-span-2">City<input name="city" defaultValue={x?.city} className="field" required /></label>
      <label className="text-xs">Province<select name="province" defaultValue={x?.province ?? "ON"} className="field">{PROVINCES.map(([c]) => <option key={c}>{c}</option>)}</select></label>
      <label className="text-xs">Zone<select name="zone" defaultValue={x?.zone ?? "local"} className="field"><option>local</option><option>regional</option><option>remote</option></select></label>
      <label className="text-xs sm:col-span-6">Postal code coverage (FSAs, comma separated)<textarea name="postal_prefixes" rows={2} defaultValue={x?.postal_prefixes.join(", ")} className="field font-mono" /></label>
      <label className="text-xs">Centre lat<input name="center_lat" type="number" step="0.0001" defaultValue={x?.center_lat ?? ""} className="field" /></label>
      <label className="text-xs">Centre lng<input name="center_lng" type="number" step="0.0001" defaultValue={x?.center_lng ?? ""} className="field" /></label>
      <label className="text-xs">Price multiplier<input name="price_multiplier" type="number" step="0.01" min="0.5" max="5" defaultValue={x?.price_multiplier ?? 1} className="field" /></label>
      <fieldset className="text-xs sm:col-span-3"><legend>Services offered</legend><div className="mt-1 flex flex-wrap gap-3 text-sm">{services?.map((s) => <label key={s.code} className="flex items-center gap-1"><input type="checkbox" name="service_codes" value={s.code} defaultChecked={x?.service_codes.includes(s.code)} /> {s.name}</label>)}</div></fieldset>
      <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-6"><input type="checkbox" name="is_active" defaultChecked={x?.is_active} /> Active (bookable and shown publicly)</label>
    </ActionForm>
  );
  return (
    <>
      <DashTitle title="Service areas" sub="Only active areas are bookable or advertised. Centre coordinates are used for distance estimates when no maps key is configured." />
      <div className="space-y-4">
        {(areas as Area[] | null)?.map((x) => (
          <Card key={x.id} className="p-5"><div className="mb-3 flex items-center gap-2"><h2 className="font-bold">{x.name}</h2><Badge tone={x.is_active ? "success" : "neutral"}>{x.is_active ? "Active" : "Inactive"}</Badge></div><AreaForm x={x} /></Card>
        ))}
        <Card className="border-dashed p-5"><h2 className="mb-3 font-bold">New area</h2><AreaForm /></Card>
      </div>

      <h2 className="mb-3 mt-10 text-xl font-bold">Intercity lanes</h2>
      <p className="mb-4 text-sm text-muted">Shipments between two different areas need an active lane. Lanes set which services run between them, a surcharge and transit time.</p>
      <Card className="p-5">
        {lanes?.length ? (
          <table className="table mb-6"><thead><tr><th>From</th><th>To</th><th>Services</th><th>Surcharge</th><th>Days</th><th>Status</th></tr></thead>
            <tbody>{lanes.map((l) => <tr key={l.id}><td>{name.get(l.origin_area_id)}</td><td>{name.get(l.destination_area_id)}</td><td>{l.service_codes.join(", ")}</td><td>${(l.surcharge_cents / 100).toFixed(2)}</td><td>{l.transit_days}</td><td>{l.is_active ? "Active" : "Inactive"}</td></tr>)}</tbody>
          </table>
        ) : <p className="mb-4 text-sm text-muted">No lanes yet.</p>}
        <ActionForm action={upsertLaneAction} submit="Save lane" className="grid gap-2 sm:grid-cols-4">
          <select name="origin_area_id" className="field" required>{areas?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select name="destination_area_id" className="field" required>{areas?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <input name="surcharge" type="number" step="0.01" min="0" placeholder="Surcharge $" className="field" />
          <input name="transit_days" type="number" min="0" placeholder="Transit days" className="field" />
          <div className="flex flex-wrap gap-3 text-sm sm:col-span-4">{services?.map((s) => <label key={s.code} className="flex items-center gap-1"><input type="checkbox" name="service_codes" value={s.code} /> {s.name}</label>)}</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="both_ways" defaultChecked /> Both directions</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" /> Active</label>
        </ActionForm>
      </Card>
    </>
  );
}
