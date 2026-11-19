import { ButtonLink, Card, PageHeader, Section } from "@/components/ui";
import { BusinessApplicationForm } from "@/components/forms/PublicForms";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "Apply for a Business Account" };

export default async function BusinessApplyPage() {
  const user = await getSessionUser();
  const pending = user?.businesses.find((b) => b.status !== "approved");
  return (
    <>
      <PageHeader eyebrow="Business account" title="Apply for business shipping" />
      <Section>
        <Card className="mx-auto max-w-3xl p-6 md:p-8">
          {!user ? (
            <div className="text-center">
              <p className="text-muted">Sign in or create an account to apply. The account you use becomes the business owner.</p>
              <div className="mt-5 flex justify-center gap-3"><ButtonLink href="/sign-in?next=/business/apply">Sign in</ButtonLink><ButtonLink href="/sign-up" variant="outline">Create account</ButtonLink></div>
            </div>
          ) : pending ? (
            <p>Your application for <strong>{pending.name}</strong> is <strong>{pending.status.replace("_", " ")}</strong>. We&apos;ll email you when it&apos;s reviewed.</p>
          ) : (
            <BusinessApplicationForm />
          )}
        </Card>
      </Section>
    </>
  );
}
