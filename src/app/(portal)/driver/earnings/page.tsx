import { DashTitle } from "@/components/dashboard/Shell";
import { Alert, Stat } from "@/components/ui";
import { requireDriverPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export default async function Earnings() {
  const u = await requireDriverPage();
  const admin = createAdminClient();
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const [{ count: deliveries }, { count: pickups }] = await Promise.all([
    admin.from("shipment_events").select("id", { count: "exact", head: true }).eq("actor_profile_id", u.id).eq("status", "delivered").gte("created_at", start.toISOString()),
    admin.from("shipment_events").select("id", { count: "exact", head: true }).eq("actor_profile_id", u.id).eq("status", "picked_up").gte("created_at", start.toISOString()),
  ]);
  return (
    <>
      <DashTitle title="Compensation" sub="Work completed this month." />
      <div className="grid grid-cols-2 gap-3 md:max-w-lg"><Stat label="Deliveries this month" value={deliveries ?? 0} /><Stat label="Pickups this month" value={pickups ?? 0} /></div>
      <div className="mt-6 max-w-2xl"><Alert>Pay rates and statements are managed by 8th Flame payroll and aren&apos;t calculated in this portal yet. Contact your operations manager for pay questions.</Alert></div>
    </>
  );
}
