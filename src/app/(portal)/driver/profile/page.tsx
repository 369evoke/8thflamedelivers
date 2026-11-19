import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { requireDriverPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export default async function Profile() {
  const u = await requireDriverPage();
  const { data: d } = await createAdminClient().from("drivers").select("vehicle_type, vehicle_info, status, created_at, service_areas(name)").eq("id", u.driverId!).single();
  return (
    <>
      <DashTitle title="Profile" />
      <Card className="max-w-lg space-y-2 text-sm">
        <p><span className="text-muted">Name:</span> {u.fullName}</p>
        <p><span className="text-muted">Email:</span> {u.email}</p>
        <p><span className="text-muted">Phone:</span> {u.phone ?? "—"}</p>
        <p><span className="text-muted">Vehicle:</span> {d?.vehicle_type} {d?.vehicle_info}</p>
        <p><span className="text-muted">Home area:</span> {(d?.service_areas as unknown as { name: string } | null)?.name ?? "—"}</p>
        <p><span className="text-muted">Driver since:</span> {d && new Date(d.created_at).toLocaleDateString("en-CA")}</p>
        <Link href="/account/settings" className="inline-block pt-2 font-semibold text-gold-dark underline">Edit name & phone</Link>
      </Card>
    </>
  );
}
