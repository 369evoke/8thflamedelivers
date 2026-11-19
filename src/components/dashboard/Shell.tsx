import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ShellNav, type NavItem } from "./ShellNav";
import { signOutAction } from "@/app/actions/auth";

export function DashboardShell({
  title,
  nav,
  user,
  children,
}: {
  title: string;
  nav: NavItem[];
  user: { name: string; roleLabel: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ivory lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="no-print hidden border-r border-beige bg-white lg:flex lg:flex-col">
        <div className="border-b border-beige px-5 py-4"><Link href="/"><Logo size={32} /></Link></div>
        <p className="px-5 pb-2 pt-5 eyebrow">{title}</p>
        <ShellNav items={nav} />
        <div className="mt-auto border-t border-beige px-5 py-4 text-sm">
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-muted">{user.roleLabel}</p>
          <form action={signOutAction} className="mt-3"><button className="text-xs font-semibold text-gold-dark hover:underline">Sign out</button></form>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-beige bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/"><Logo size={28} /></Link>
          <ShellNav items={nav} mobile />
        </div>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

export function DashTitle({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
        {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
