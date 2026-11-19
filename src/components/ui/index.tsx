import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { STATUS_LABELS, statusTone, type ShipmentStatus } from "@/lib/status";

type Variant = "primary" | "gold" | "outline" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-charcoal text-ivory hover:bg-charcoal-soft",
  gold: "bg-gold text-charcoal hover:bg-gold-dark hover:text-ivory",
  outline: "border border-charcoal/25 text-charcoal hover:border-charcoal bg-white/60",
  ghost: "text-charcoal hover:bg-beige/60",
  danger: "bg-danger text-white hover:opacity-90",
};
const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

export function Button({ variant = "primary", className = "", ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...p} />;
}

export function ButtonLink({ variant = "primary", className = "", ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...p} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[var(--radius-card)] border border-beige bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03)] ${className}`}>{children}</div>;
}

export function Section({ className = "", children, id }: { className?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className={`px-5 py-16 md:py-24 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function PageHeader({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <div className="border-b border-beige bg-white/50 px-5 py-14 md:py-20">
      <div className="mx-auto max-w-6xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="max-w-3xl text-3xl font-extrabold md:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-muted">{intro}</p>}
      </div>
    </div>
  );
}

const tones = {
  neutral: "bg-beige text-charcoal",
  gold: "bg-gold/15 text-gold-dark",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return <Badge tone={statusTone(status)}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-beige bg-white/60 px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger"; children: ReactNode }) {
  const t = {
    neutral: "border-beige bg-white",
    success: "border-success/30 bg-success/5 text-success",
    warning: "border-warning/30 bg-warning/5 text-warning",
    danger: "border-danger/30 bg-danger/5 text-danger",
  }[tone];
  return <div role={tone === "danger" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${t}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Field({ label, name, error, hint, children }: { label: string; name?: string; error?: string; hint?: string; children?: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function NotConfigured({ what, env }: { what: string; env: string }) {
  return (
    <Alert tone="warning">
      <strong>{what} isn&apos;t connected yet.</strong> Add <code className="rounded bg-beige px-1">{env}</code> to your environment variables. See README › Setup.
    </Alert>
  );
}
