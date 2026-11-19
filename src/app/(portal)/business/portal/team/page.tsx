import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireBusinessPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { addMemberAction, removeMemberAction } from "@/app/actions/business";

export default async function Team() {
  const { user, business } = await requireBusinessPage();
  const isAdmin = ["owner", "admin"].includes(business.member_role);
  const { data } = await createAdminClient().from("business_members").select("id, member_role, profile_id, profiles(full_name, email)").eq("business_id", business.id);
  return (
    <>
      <DashTitle title="Team members" sub="Authorized employees can create and track shipments for this business." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="overflow-x-auto rounded-xl border border-beige bg-white"><table className="table">
          <thead><tr><th>Name</th><th>Role</th><th /></tr></thead>
          <tbody>{data?.map((m) => { const p = m.profiles as unknown as { full_name: string; email: string }; return (
            <tr key={m.id}><td><p className="font-semibold">{p?.full_name}</p><p className="text-xs text-muted">{p?.email}</p></td><td className="capitalize">{m.member_role}</td>
              <td>{isAdmin && m.member_role !== "owner" && m.profile_id !== user.id && <form action={removeMemberAction}><input type="hidden" name="business_id" value={business.id} /><input type="hidden" name="member_id" value={m.id} /><button className="text-xs font-semibold text-danger">Remove</button></form>}</td></tr>
          ); })}</tbody>
        </table></div>
        {isAdmin && (
          <Card>
            <h2 className="mb-3 font-bold">Add team member</h2>
            <ActionForm action={addMemberAction} submit="Add member" resetOnSuccess>
              <input type="hidden" name="business_id" value={business.id} />
              <input name="email" type="email" placeholder="Their 8th Flame account email" className="field" required />
              <select name="member_role" className="field"><option value="member">Member — create & track shipments</option><option value="admin">Admin — also manage team & invoices</option></select>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
