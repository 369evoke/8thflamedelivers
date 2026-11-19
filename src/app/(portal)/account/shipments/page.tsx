import { DashTitle } from "@/components/dashboard/Shell";
import { ShipmentTable, SHIPMENT_LIST_COLUMNS } from "@/components/dashboard/ShipmentTable";
import { requireUser } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui";

export default async function MyShipments({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await requireUser();
  const { q } = await searchParams;
  const db = await createUserClient();
  let query = db.from("shipments").select(SHIPMENT_LIST_COLUMNS).eq("customer_profile_id", u.id).order("created_at", { ascending: false }).limit(200);
  if (q) query = query.ilike("tracking_number", `%${q.replace(/[^A-Za-z0-9]/g, "")}%`);
  const { data } = await query;
  return (
    <>
      <DashTitle title="My shipments" actions={<ButtonLink href="/ship">New shipment</ButtonLink>} />
      <form className="mb-4 flex max-w-sm gap-2"><input name="q" defaultValue={q} placeholder="Search tracking number" className="field" /><button className="rounded-lg border border-beige bg-white px-3 text-sm font-semibold">Search</button></form>
      <ShipmentTable rows={data ?? []} base="/account/shipments" />
    </>
  );
}
