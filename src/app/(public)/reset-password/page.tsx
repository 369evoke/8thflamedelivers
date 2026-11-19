import { AuthCard } from "../auth-card";
import { ResetForm } from "@/components/forms/AuthForms";
import { integrations } from "@/lib/env";

export const metadata = { title: "Choose a New Password" };

export default function ResetPage() {
  return (
    <AuthCard title="Choose a new password" configured={integrations.supabase()}>
      <ResetForm />
    </AuthCard>
  );
}
