import { DashTitle } from "@/components/dashboard/Shell";
import { AddressForm } from "@/components/forms/AddressForm";
import { Card, EmptyState } from "@/components/ui";
import { requireBusinessPage } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { deleteAddressAction } from "@/app/actions/customer";

export default async function Addresses() {
  const { business } = await requireBusinessPage();
  const db = await createUserClient();
  const { data } = await db.from("addresses").select("*").eq("business_id", business.id).order("created_at", { ascending: false });
  return (
    <>
      <DashTitle title="Saved addresses" sub="Shared with your whole team. Use a pickup address for bulk uploads." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {data?.length ? data.map((a) => (
            <Card key={a.id}><p className="font-semibold">{a.label || a.contact_name}</p><p className="text-sm text-muted">{a.street}, {a.city} {a.province} {a.postal_code}</p><form action={deleteAddressAction} className="mt-2"><input type="hidden" name="id" value={a.id} /><button className="text-xs font-semibold text-danger">Delete</button></form></Card>
          )) : <div className="sm:col-span-2"><EmptyState title="No saved addresses" /></div>}
        </div>
        <Card><h2 className="mb-4 font-bold">Add address</h2><AddressForm businessId={business.id} /></Card>
      </div>
    </>
  );
}
