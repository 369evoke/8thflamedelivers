import { notFound } from "next/navigation";
import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireUser } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { replyTicketAction } from "@/app/actions/customer";

export default async function Ticket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const db = await createUserClient(); // RLS hides other users' tickets and internal notes
  const { data: t } = await db.from("support_tickets").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: msgs } = await db.from("support_messages").select("*").eq("ticket_id", id).order("created_at");
  return (
    <>
      <DashTitle title={t.subject} sub={<>{t.ticket_number} · <Badge>{t.status.replace(/_/g, " ")}</Badge></>} />
      <div className="max-w-3xl space-y-3">
        {msgs?.map((m) => (
          <Card key={m.id} className={m.author_profile_id === t.profile_id ? "" : "border-gold/40 bg-gold/5"}>
            <p className="text-xs text-muted">{m.author_label} · {new Date(m.created_at).toLocaleString("en-CA")}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{m.body}</p>
          </Card>
        ))}
        {t.status !== "closed" && (
          <Card><ActionForm action={replyTicketAction} submit="Send reply" resetOnSuccess><input type="hidden" name="ticket_id" value={id} /><textarea name="body" rows={4} className="field" required /></ActionForm></Card>
        )}
      </div>
    </>
  );
}
