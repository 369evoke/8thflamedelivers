import { notFound } from "next/navigation";
import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { ShipmentDetail, loadShipment } from "@/components/dashboard/ShipmentDetail";
import { ActionForm } from "@/components/forms/ActionForm";
import { Card } from "@/components/ui";
import { canAccessShipment, requireBusinessPage } from "@/lib/auth";
import { cancelShipmentAction } from "@/app/actions/customer";
import { loadSettings } from "@/lib/quote-service";

export default async function BizShipment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, business } = await requireBusinessPage();
  if (!(await canAccessShipment(user, id))) notFound();
  const data = await loadShipment(id);
  if (!data.s || data.s.business_id !== business.id) notFound();
  const { cancellable } = await loadSettings();
  const canCancel = ["owner", "admin"].includes(business.member_role) && cancellable.includes(data.s.status) && !data.assignment.length;
  return (
    <>
      <DashTitle title="Shipment" sub={<Link href="/business/portal/shipments" className="underline">← History</Link>} />
      <ShipmentDetail data={data} actions={canCancel ? <Card className="p-6"><ActionForm action={cancelShipmentAction} submit="Cancel shipment" variant="danger" confirm="Cancel this shipment?"><input type="hidden" name="id" value={id} /></ActionForm></Card> : undefined} />
    </>
  );
}
