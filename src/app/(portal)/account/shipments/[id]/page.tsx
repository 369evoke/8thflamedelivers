import { notFound } from "next/navigation";
import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { ShipmentDetail, loadShipment } from "@/components/dashboard/ShipmentDetail";
import { ActionForm } from "@/components/forms/ActionForm";
import { Card } from "@/components/ui";
import { canAccessShipment, requireUser } from "@/lib/auth";
import { cancelShipmentAction } from "@/app/actions/customer";
import { loadSettings } from "@/lib/quote-service";

export default async function MyShipment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  if (!(await canAccessShipment(u, id))) notFound();
  const data = await loadShipment(id);
  if (!data.s) notFound();
  const { cancellable } = await loadSettings();
  const canCancel = cancellable.includes(data.s.status) && data.assignment.length === 0 && data.s.customer_profile_id === u.id;
  return (
    <>
      <DashTitle title="Shipment details" sub={<Link href="/account/shipments" className="underline">← All shipments</Link>} />
      <ShipmentDetail
        data={data}
        actions={
          <Card className="p-6">
            <h2 className="mb-3 font-bold">Need help?</h2>
            <p className="mb-4 text-sm text-muted">Questions about this shipment? <Link href={`/account/support?shipment=${id}`} className="underline">Open a support ticket</Link>.</p>
            {canCancel && (
              <ActionForm action={cancelShipmentAction} submit="Cancel shipment" variant="danger" confirm="Cancel this shipment? If you paid by card, a refund will be issued.">
                <input type="hidden" name="id" value={id} />
              </ActionForm>
            )}
          </Card>
        }
      />
    </>
  );
}
