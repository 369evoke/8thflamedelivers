import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireDriverPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { availabilityAction } from "@/app/actions/driver";

export default async function Availability() {
  const u = await requireDriverPage();
  const { data: d } = await createAdminClient().from("drivers").select("is_available, availability_notes").eq("id", u.driverId!).single();
  return (
    <>
      <DashTitle title="Availability" sub="Dispatch sees this when assigning work." />
      <Card className="max-w-lg">
        <ActionForm action={availabilityAction}>
          <label className="flex items-center gap-3 text-base font-semibold"><input type="checkbox" name="is_available" defaultChecked={d?.is_available} className="h-5 w-5" /> I&apos;m available for assignments</label>
          <div><label className="label" htmlFor="n">Schedule notes</label><textarea id="n" name="availability_notes" defaultValue={d?.availability_notes ?? ""} rows={3} className="field" placeholder="e.g. Mon–Fri 8am–4pm" /></div>
        </ActionForm>
      </Card>
    </>
  );
}
