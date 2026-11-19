import { notFound } from "next/navigation";
import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { staffTicketAction } from "@/app/actions/admin";
import { STAFF_ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function TicketAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage("support.manage");
  const a = createAdminClient();
  const [{ data: t }, { data: msgs }, { data: staff }] = await Promise.all([
    a.from("support_tickets").select("*, shipments(id, tracking_number)").eq("id", id).maybeSingle(),
    a.from("support_messages").select("*").eq("ticket_id", id).order("created_at"),
    a.from("profiles").select("id, full_name").in("role", STAFF_ROLES).eq("is_active", true),
  ]);
  if (!t) notFound();
  const sh = t.shipments as unknown as { id: string; tracking_number: string } | null;
  return (
    <>
      <DashTitle title={t.subject} sub={<>{t.ticket_number} · {t.contact_name} &lt;{t.contact_email}&gt; · {t.category.replace(/_/g, " ")}{sh && <> · <Link className="underline" href={`/admin/shipments/${sh.id}`}>{sh.tracking_number}</Link></>}</>} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {msgs?.map((m) => (
            <Card key={m.id} className={m.is_internal ? "border-dashed bg-beige/40" : m.author_profile_id === t.profile_id ? "" : "border-gold/40 bg-gold/5"}>
              <p className="text-xs text-muted">{m.is_internal && <strong>Internal · </strong>}{m.author_label} · {new Date(m.created_at).toLocaleString("en-CA")}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
            </Card>
          ))}
        </div>
        <Card>
          <ActionForm action={staffTicketAction} submit="Update ticket" resetOnSuccess>
            <input type="hidden" name="ticket_id" value={id} />
            <textarea name="body" rows={5} placeholder="Reply to the customer, or add an internal note" className="field" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="internal" /> Internal note (not sent to customer)</label>
            <div className="grid grid-cols-2 gap-2">
              <select name="status" defaultValue={t.status} className="field">{["open", "in_progress", "waiting_on_customer", "resolved", "closed"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
              <select name="priority" defaultValue={t.priority} className="field">{["low", "normal", "high", "urgent"].map((s) => <option key={s}>{s}</option>)}</select>
            </div>
            <select name="assigned_to" defaultValue={t.assigned_to ?? ""} className="field"><option value="">Unassigned</option>{staff?.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
