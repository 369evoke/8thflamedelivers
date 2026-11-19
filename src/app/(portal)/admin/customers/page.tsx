import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, EmptyState } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { hasPermission, ROLE_LABELS, type Role } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/server";
import { setAccountActiveAction } from "@/app/actions/admin";

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await requireStaffPage("customers.view");
  const { q } = await searchParams;
  let query = createAdminClient().from("profiles").select("id, email, full_name, phone, role, is_active, created_at").eq("role", "customer").order("created_at", { ascending: false }).limit(200);
  if (q) { const t = q.replace(/[%,()]/g, ""); query = query.or(`email.ilike.%${t}%,full_name.ilike.%${t}%,phone.ilike.%${t}%`); }
  const { data } = await query;
  const ids = (data ?? []).map((p) => p.id);
  const { data: counts } = ids.length ? await createAdminClient().from("shipments").select("customer_profile_id").in("customer_profile_id", ids) : { data: [] };
  const n = new Map<string, number>(); (counts ?? []).forEach((c) => n.set(c.customer_profile_id, (n.get(c.customer_profile_id) ?? 0) + 1));
  const canManage = hasPermission(u.role, "customers.manage");
  return (
    <>
      <DashTitle title="Customers" />
      <form className="mb-4 flex max-w-md gap-2"><input name="q" defaultValue={q} placeholder="Search name, email or phone" className="field" /><button className="rounded-lg bg-charcoal px-3 text-sm font-semibold text-ivory">Search</button></form>
      {!data?.length ? <EmptyState title="No customers found" /> : (
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Shipments</th><th>Joined</th><th>Status</th>{canManage && <th />}</tr></thead>
          <tbody>{data.map((p) => (
            <tr key={p.id}>
              <td className="font-semibold">{p.full_name ?? "—"}</td><td>{p.email}</td><td>{p.phone ?? "—"}</td>
              <td><a className="underline" href={`/admin/shipments?q=&customer=${p.id}`}>{n.get(p.id) ?? 0}</a></td>
              <td>{new Date(p.created_at).toLocaleDateString("en-CA")}</td>
              <td><Badge tone={p.is_active ? "success" : "danger"}>{p.is_active ? "Active" : "Inactive"}</Badge> <span className="text-xs text-muted">{ROLE_LABELS[p.role as Role]}</span></td>
              {canManage && <td><ActionForm action={setAccountActiveAction} submit={p.is_active ? "Deactivate" : "Reactivate"} variant="outline" className="" confirm="Change this account's status?"><input type="hidden" name="profile_id" value={p.id} /><input type="hidden" name="active" value={String(!p.is_active)} /></ActionForm></td>}
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="mt-3 text-xs text-muted">Support requests from customers are under Customer Support.</p>
    </>
  );
}
