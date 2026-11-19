import Link from "next/link";
import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireUser } from "@/lib/auth";
import { updateProfileAction } from "@/app/actions/customer";

export default async function Settings() {
  const u = await requireUser();
  return (
    <>
      <DashTitle title="Account settings" />
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-bold">Profile</h2>
          <ActionForm action={updateProfileAction}>
            <div><label className="label" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" defaultValue={u.fullName ?? ""} className="field" /></div>
            <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" defaultValue={u.phone ?? ""} className="field" /></div>
            <p className="text-sm text-muted">Email: {u.email}</p>
          </ActionForm>
        </Card>
        <Card>
          <h2 className="mb-2 font-bold">Security & privacy</h2>
          <p className="text-sm text-muted">Change your password using a secure email link.</p>
          <Link href="/forgot-password" className="mt-3 inline-block text-sm font-semibold text-gold-dark underline">Send password reset link</Link>
          <p className="mt-6 text-sm text-muted">To request a copy of your personal information, or to close your account, <Link href="/account/support" className="underline">contact support</Link>. See our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
        </Card>
      </div>
    </>
  );
}
