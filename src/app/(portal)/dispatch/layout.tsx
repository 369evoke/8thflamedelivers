import { DashboardShell } from "@/components/dashboard/Shell";
import { requireStaffPage } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/permissions";

export default async function DispatchLayout({ children }: { children: React.ReactNode }) {
  const u = await requireStaffPage("dispatch.assign");
  const nav = [
    { href: "/dispatch", label: "Dispatch board" },
    { href: "/dispatch/routes", label: "Routes" },
    { href: "/dispatch/map", label: "Map" },
    { href: "/admin/shipments", label: "All shipments" },
    { href: "/admin/drivers", label: "Drivers" },
    { href: "/admin", label: "→ Admin dashboard" },
  ];
  return <DashboardShell title="Dispatch" nav={nav} user={{ name: u.fullName ?? u.email, roleLabel: ROLE_LABELS[u.role] }}>{children}</DashboardShell>;
}
