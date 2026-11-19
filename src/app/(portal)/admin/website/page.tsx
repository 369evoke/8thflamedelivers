import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { loadSettings } from "@/lib/quote-service";
import { saveCompanyAction } from "@/app/actions/admin";

export default async function Website() {
  await requireStaffPage("settings.manage");
  const { company } = await loadSettings();
  return (
    <>
      <DashTitle title="Website management" sub="Public contact details shown on the Contact page, receipts and emails. Service areas and services shown on the website come from their own sections — only active ones appear." />
      <Card className="max-w-xl">
        <ActionForm action={saveCompanyAction}>
          <label className="block text-sm">Company name<input name="name" defaultValue={company.name ?? "8th Flame Delivery"} className="field" /></label>
          <label className="block text-sm">Support email<input name="support_email" type="email" defaultValue={company.support_email ?? ""} className="field" /></label>
          <label className="block text-sm">Phone<input name="phone" defaultValue={company.phone ?? ""} className="field" /></label>
          <label className="block text-sm">Business address<input name="address" defaultValue={company.address ?? ""} className="field" /></label>
        </ActionForm>
      </Card>
      <p className="mt-4 max-w-xl text-sm text-muted">To use a photograph in the homepage hero, add <code>public/images/hero-courier.jpg</code> (licensed photo, 1120×840 or larger) and redeploy.</p>
    </>
  );
}
