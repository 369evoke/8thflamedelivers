import { Alert, ButtonLink, Stat } from "@/components/ui";
import { DashTitle } from "@/components/dashboard/Shell";
import { ShipmentTable, SHIPMENT_LIST_COLUMNS } from "@/components/dashboard/ShipmentTable";
import { requireUser } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { ACTIVE_STATUSES } from "@/lib/status";

export default async function AccountHome({ searchParams }: { searchParams: Promise<{ denied?: string; reset?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const db = await createUserClient(); // RLS: only this customer's shipments
  const mine = db.from("shipments").select(SHIPMENT_LIST_COLUMNS).eq("customer_profile_id", u.id);
  const [{ count: total }, { count: active }, { count: delivered }, { count: pending }, { data: recent }] = await Promise.all([
    db.from("shipments").select("id", { count: "exact", head: true }).eq("customer_profile_id", u.id).in("payment_status", ["paid", "invoiced", "refunded", "partially_refunded"]),
    db.from("shipments").select("id", { count: "exact", head: true }).eq("customer_profile_id", u.id).in("status", ACTIVE_STATUSES),
    db.from("shipments").select("id", { count: "exact", head: true }).eq("customer_profile_id", u.id).eq("status", "delivered"),
    db.from("shipments").select("id", { count: "exact", head: true }).eq("customer_profile_id", u.id).in("status", ["shipment_created", "awaiting_confirmation"]),
    mine.order("created_at", { ascending: false }).limit(5),
  ]);
  return (
    <>
      {sp.denied && <div className="mb-4"><Alert tone="warning">You don&apos;t have access to that area.</Alert></div>}
      {sp.reset && <div className="mb-4"><Alert tone="success">Your password has been updated.</Alert></div>}
      <DashTitle title={`Welcome${u.fullName ? `, ${u.fullName.split(" ")[0]}` : ""}`} actions={<ButtonLink href="/ship">Ship a package</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total shipments" value={total ?? 0} />
        <Stat label="Active" value={active ?? 0} />
        <Stat label="Delivered" value={delivered ?? 0} />
        <Stat label="Pending" value={pending ?? 0} hint="Awaiting payment or confirmation" />
      </div>
      <h2 className="mb-3 mt-10 font-bold">Recent activity</h2>
      <ShipmentTable rows={recent ?? []} base="/account/shipments" empty="You haven't booked any shipments yet." />
    </>
  );
}
