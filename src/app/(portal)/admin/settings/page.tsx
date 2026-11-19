import { DashTitle } from "@/components/dashboard/Shell";
import { Alert, Badge, Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { updateSettingAction } from "@/app/actions/admin";
import { integrations } from "@/lib/env";

export default async function Settings() {
  await requireStaffPage("pricing.manage");
  const { data } = await createAdminClient().from("platform_settings").select("*").neq("key", "company").order("key");
  const checks = [["Supabase", integrations.supabase()], ["Stripe payments + webhook", integrations.stripe()], ["Resend email", integrations.email()], ["Google Maps (server distance)", integrations.maps()], ["Google Maps (browser map)", !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY]] as const;
  return (
    <>
      <DashTitle title="Settings" sub="Operational rules used by booking, validation and cancellation." />
      <Card className="mb-6">
        <h2 className="mb-3 font-bold">Integrations</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">{checks.map(([n, ok]) => <li key={n} className="flex items-center justify-between rounded-lg border border-beige px-3 py-2">{n}<Badge tone={ok ? "success" : "warning"}>{ok ? "Connected" : "Not configured"}</Badge></li>)}</ul>
      </Card>
      <Alert>Edit values as JSON. Package limits, restricted-item keywords, pickup windows and the cancellation policy take effect immediately.</Alert>
      <div className="mt-4 space-y-4">
        {data?.map((s) => (
          <Card key={s.key}>
            <p className="font-mono font-bold">{s.key}</p>
            <p className="mb-2 text-xs text-muted">{s.description}</p>
            <ActionForm action={updateSettingAction}>
              <input type="hidden" name="key" value={s.key} />
              <textarea name="value" rows={Math.min(10, JSON.stringify(s.value, null, 2).split("\n").length + 1)} defaultValue={JSON.stringify(s.value, null, 2)} className="field font-mono text-xs" />
            </ActionForm>
          </Card>
        ))}
      </div>
    </>
  );
}
