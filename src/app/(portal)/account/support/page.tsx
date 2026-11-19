import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireUser } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { createTicketAction } from "@/app/actions/customer";

export default async function Support({ searchParams }: { searchParams: Promise<{ shipment?: string }> }) {
  const u = await requireUser();
  const { shipment } = await searchParams;
  const db = await createUserClient();
  const [{ data: tickets }, { data: shipments }] = await Promise.all([
    db.from("support_tickets").select("id, ticket_number, subject, status, updated_at").eq("profile_id", u.id).order("updated_at", { ascending: false }),
    db.from("shipments").select("id, tracking_number").eq("customer_profile_id", u.id).order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <>
      <DashTitle title="Support" sub="Report a missing or delayed shipment, ask a billing question or request help." />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          {!tickets?.length ? <EmptyState title="No support tickets" /> : tickets.map((t) => (
            <Link key={t.id} href={`/account/support/${t.id}`} className="block"><Card className="hover:border-gold">
              <div className="flex justify-between gap-2"><p className="font-semibold">{t.subject}</p><Badge tone={t.status === "resolved" || t.status === "closed" ? "success" : "gold"}>{t.status.replace(/_/g, " ")}</Badge></div>
              <p className="text-xs text-muted">{t.ticket_number} · updated {new Date(t.updated_at).toLocaleString("en-CA")}</p>
            </Card></Link>
          ))}
        </div>
        <Card>
          <h2 className="mb-4 font-bold">New request</h2>
          <ActionForm action={createTicketAction} submit="Submit request" resetOnSuccess>
            <select name="category" className="field" defaultValue={shipment ? "delayed_shipment" : "general"}>
              <option value="general">General help</option><option value="missing_shipment">Missing shipment</option><option value="delayed_shipment">Delayed shipment</option><option value="damage">Damaged package</option><option value="billing">Billing question</option>
            </select>
            <select name="shipment_id" className="field" defaultValue={shipment ?? ""}>
              <option value="">No specific shipment</option>
              {shipments?.map((s) => <option key={s.id} value={s.id}>{s.tracking_number}</option>)}
            </select>
            <input name="subject" placeholder="Subject" className="field" required />
            <textarea name="message" rows={5} placeholder="How can we help?" className="field" required />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
