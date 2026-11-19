import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, EmptyState } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { setDriverStatusAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function Drivers() {
  await requireStaffPage("drivers.manage");
  const a = createAdminClient();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ data: drivers }, { data: areas }, { data: active }, { data: ev }] = await Promise.all([
    a.from("drivers").select("id, status, is_available, vehicle_type, home_area_id, profile_id, created_at, profiles(full_name, email, phone)").order("created_at", { ascending: false }),
    a.from("service_areas").select("id, name"),
    a.from("shipment_assignments").select("driver_id").eq("is_active", true),
    a.from("shipment_events").select("actor_profile_id, status").in("status", ["delivered", "delivery_attempted", "exception"]).gte("created_at", since),
  ]);
  const act = new Map<string, number>(); (active ?? []).forEach((x) => act.set(x.driver_id, (act.get(x.driver_id) ?? 0) + 1));
  const perf = new Map<string, { d: number; f: number }>(); (ev ?? []).forEach((e) => { const p = perf.get(e.actor_profile_id) ?? { d: 0, f: 0 }; if (e.status === "delivered") p.d++; else p.f++; perf.set(e.actor_profile_id, p); });
  return (
    <>
      <DashTitle title="Drivers" sub="Approved and suspended drivers. Performance covers the last 30 days." />
      {!drivers?.length ? <EmptyState title="No drivers yet" body="Approve applications to add drivers." /> : (
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>Driver</th><th>Status</th><th>Availability</th><th>Active jobs</th><th>Delivered / issues (30d)</th><th>Manage</th></tr></thead>
          <tbody>{drivers.map((d) => {
            const p = d.profiles as unknown as { full_name: string; email: string; phone: string };
            const pf = perf.get(d.profile_id) ?? { d: 0, f: 0 };
            return (
              <tr key={d.id}>
                <td><p className="font-semibold">{p?.full_name}</p><p className="text-xs text-muted">{p?.email} · {p?.phone} · {d.vehicle_type}</p></td>
                <td><Badge tone={d.status === "approved" ? "success" : "danger"}>{d.status}</Badge></td>
                <td>{d.is_available ? "Available" : "Off"}</td>
                <td>{act.get(d.id) ?? 0}</td>
                <td>{pf.d} / {pf.f}{pf.d + pf.f > 0 && <span className="text-xs text-muted"> ({Math.round((pf.d / (pf.d + pf.f)) * 100)}%)</span>}</td>
                <td>
                  <ActionForm action={setDriverStatusAction} submit="Save" variant="outline" className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <select name="status" defaultValue={d.status} className="field !w-auto !py-1"><option value="approved">approved</option><option value="suspended">suspended</option></select>
                    <select name="home_area_id" defaultValue={d.home_area_id ?? ""} className="field !w-auto !py-1"><option value="">No home area</option>{areas?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                  </ActionForm>
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </>
  );
}
