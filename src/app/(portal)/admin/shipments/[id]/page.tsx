import { notFound } from "next/navigation";
import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { ShipmentDetail, loadShipment } from "@/components/dashboard/ShipmentDetail";
import { StaffShipmentActions } from "@/components/dashboard/StaffShipmentActions";
import { requireStaffPage } from "@/lib/auth";
import { approvedDrivers } from "@/lib/ops-data";

export const dynamic = "force-dynamic";

export default async function AdminShipment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireStaffPage("shipments.view_all");
  const [data, drivers] = await Promise.all([loadShipment(id), approvedDrivers()]);
  if (!data.s) notFound();
  return (
    <>
      <DashTitle title="Shipment" sub={<Link href="/admin/shipments" className="underline">← Shipments</Link>} />
      <ShipmentDetail staff data={data} actions={<StaffShipmentActions role={u.role} s={data.s} drivers={drivers} payments={data.payments} scheduled={!!data.schedule} />} />
    </>
  );
}
