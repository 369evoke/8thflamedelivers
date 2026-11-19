"use client";
import { useActionState, useEffect, useRef } from "react";
import { Alert, Button } from "@/components/ui";
import type { FormState } from "@/app/actions/auth";

/** Generic client wrapper for a server action returning FormState. Shows pending, error and success states. */
export function ActionForm({
  action,
  children,
  submit = "Save",
  className = "space-y-4",
  variant,
  confirm,
  resetOnSuccess = false,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  children?: React.ReactNode;
  submit?: string;
  className?: string;
  variant?: "primary" | "gold" | "outline" | "danger";
  confirm?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, act, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={act}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {children}
      <Button variant={variant} disabled={pending}>{pending ? "Working…" : submit}</Button>
    </form>
  );
}
