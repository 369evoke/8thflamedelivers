import { AuthCard } from "../auth-card";
import { SignUpForm } from "@/components/forms/AuthForms";
import { integrations } from "@/lib/env";

export const metadata = { title: "Create Account" };

export default function SignUpPage() {
  return (
    <AuthCard title="Create your account" sub="Save addresses, track every shipment and download receipts." configured={integrations.supabase()}>
      <SignUpForm />
    </AuthCard>
  );
}
