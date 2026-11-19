import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { requireBusinessPage } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";

export default async function Settings() {
  const { business } = await requireBusinessPage();
  const db = await createUserClient();
  const { data: b } = await db.from("businesses").select("*").eq("id", business.id).single();
  return (
    <>
      <DashTitle title="Account settings" />
      <Card className="max-w-xl space-y-1 text-sm">
        <p><span className="text-muted">Business:</span> {b.name}</p>
        <p><span className="text-muted">Contact:</span> {b.contact_name} · {b.email} · {b.phone}</p>
        <p><span className="text-muted">Address:</span> {b.address}, {b.city} {b.province}</p>
        <p><span className="text-muted">Negotiated discount:</span> {b.discount_percent}%</p>
        <p><span className="text-muted">Invoice billing:</span> {b.invoicing_enabled ? `Enabled, net ${b.payment_terms_days} days` : "Not enabled — pay by card"}</p>
        <p className="pt-3 text-muted">To change business details or rates, open a support request.</p>
      </Card>
    </>
  );
}
