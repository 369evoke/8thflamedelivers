import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { changeRoleAction, createEmployeeAction } from "@/app/actions/admin";
import { assignableRoles, ROLE_LABELS, ROLE_PERMISSIONS, STAFF_ROLES, type Role } from "@/lib/permissions";

export default async function Employees() {
  const u = await requireStaffPage("employees.manage");
  const { data } = await createAdminClient().from("profiles").select("id, full_name, email, role, is_active, employees(title, department)").in("role", STAFF_ROLES).order("full_name");
  const roles = assignableRoles(u.role);
  return (
    <>
      <DashTitle title="Employee management" sub="Staff roles control access everywhere — pages, server actions and database policies." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>Name</th><th>Title</th><th>Role</th></tr></thead>
          <tbody>{data?.map((p) => { const e = (p.employees as unknown as { title: string; department: string }[] | null)?.[0]; return (
            <tr key={p.id}>
              <td><p className="font-semibold">{p.full_name}</p><p className="text-xs text-muted">{p.email}{!p.is_active && " · inactive"}</p></td>
              <td>{e?.title ?? "—"}<span className="block text-xs text-muted">{e?.department}</span></td>
              <td>{p.id === u.id ? ROLE_LABELS[p.role as Role] : (
                <ActionForm action={changeRoleAction} submit="Set" variant="outline" className="flex gap-1">
                  <input type="hidden" name="profile_id" value={p.id} />
                  <select name="role" defaultValue={p.role} className="field !py-1">{[...roles, "customer" as Role].map((r) => <option key={r} value={r}>{r === "customer" ? "Remove staff access" : ROLE_LABELS[r]}</option>)}</select>
                </ActionForm>
              )}</td>
            </tr>
          ); })}</tbody>
        </table></div>
        <Card>
          <h2 className="mb-3 font-bold">Add employee</h2>
          <ActionForm action={createEmployeeAction} submit="Create & invite" resetOnSuccess>
            <input name="full_name" placeholder="Full name" className="field" required />
            <input name="email" type="email" placeholder="Work email" className="field" required />
            <select name="role" className="field">{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
            <input name="title" placeholder="Job title" className="field" />
            <input name="department" placeholder="Department" className="field" />
          </ActionForm>
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="mb-3 font-bold">Role permissions</h2>
        <div className="grid gap-4 text-sm md:grid-cols-3">{STAFF_ROLES.map((r) => <div key={r}><p className="font-semibold">{ROLE_LABELS[r]}</p><p className="text-xs text-muted">{ROLE_PERMISSIONS[r].join(", ")}</p></div>)}</div>
      </Card>
    </>
  );
}
