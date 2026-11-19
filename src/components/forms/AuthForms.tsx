"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "@/app/actions/auth";

export function SignInForm({ next }: { next: string }) {
  const [s, act, pending] = useActionState(signInAction, {});
  return (
    <form action={act} className="space-y-4">
      {s.error && <Alert tone="danger">{s.error}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email"><input id="email" name="email" type="email" required autoComplete="email" className="field" /></Field>
      <Field label="Password" name="password"><input id="password" name="password" type="password" required autoComplete="current-password" className="field" /></Field>
      <Button className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-gold-dark hover:underline">Forgot password?</Link>
        <Link href="/sign-up" className="font-semibold hover:underline">Create account</Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [s, act, pending] = useActionState(signUpAction, {});
  const e = s.fieldErrors ?? {};
  if (s.success) return <Alert tone="success">{s.success}</Alert>;
  return (
    <form action={act} className="space-y-4">
      {s.error && <Alert tone="danger">{s.error}</Alert>}
      <Field label="Full name" name="full_name" error={e.full_name}><input id="full_name" name="full_name" required autoComplete="name" className="field" /></Field>
      <Field label="Email" name="email" error={e.email}><input id="email" name="email" type="email" required autoComplete="email" className="field" /></Field>
      <Field label="Phone (optional)" name="phone"><input id="phone" name="phone" type="tel" autoComplete="tel" className="field" /></Field>
      <Field label="Password" name="password" error={e.password} hint="At least 10 characters, with a letter and a number"><input id="password" name="password" type="password" required autoComplete="new-password" className="field" /></Field>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="privacy" className="mt-1" /><span>I agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</span></label>
      {e.privacy && <p className="text-xs text-danger">{e.privacy}</p>}
      <Button className="w-full" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
      <p className="text-center text-sm">Already have an account? <Link href="/sign-in" className="font-semibold hover:underline">Sign in</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [s, act, pending] = useActionState(forgotPasswordAction, {});
  if (s.success) return <Alert tone="success">{s.success}</Alert>;
  return (
    <form action={act} className="space-y-4">
      {s.error && <Alert tone="danger">{s.error}</Alert>}
      <Field label="Email" name="email"><input id="email" name="email" type="email" required className="field" /></Field>
      <Button className="w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
    </form>
  );
}

export function ResetForm() {
  const [s, act, pending] = useActionState(resetPasswordAction, {});
  return (
    <form action={act} className="space-y-4">
      {s.error && <Alert tone="danger">{s.error}</Alert>}
      <Field label="New password" name="password" hint="At least 10 characters including a number"><input id="password" name="password" type="password" required autoComplete="new-password" className="field" /></Field>
      <Button className="w-full" disabled={pending}>{pending ? "Saving…" : "Set new password"}</Button>
    </form>
  );
}
