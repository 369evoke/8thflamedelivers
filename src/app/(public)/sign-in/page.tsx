import { AuthCard } from "../auth-card";
import { SignInForm } from "@/components/forms/AuthForms";
import { integrations } from "@/lib/env";

export const metadata = { title: "Sign In" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthCard title="Sign in" sub="Customers, business users, drivers and staff all sign in here." configured={integrations.supabase()}>
      <SignInForm next={next && next.startsWith("/") && !next.startsWith("//") ? next : "/account"} />
    </AuthCard>
  );
}
