import { AuthCard } from "../auth-card";
import { ForgotForm } from "@/components/forms/AuthForms";
import { integrations } from "@/lib/env";

export const metadata = { title: "Reset Password" };

export default function ForgotPage() {
  return (
    <AuthCard title="Reset your password" sub="We'll email you a secure link." configured={integrations.supabase()}>
      <ForgotForm />
    </AuthCard>
  );
}
