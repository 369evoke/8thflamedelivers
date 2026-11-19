import { DashboardShell } from "@/components/dashboard/Shell";
import { requireDriverPage } from "@/lib/auth";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const u = await requireDriverPage();
  const nav = [
    { href: "/driver", label: "Overview" },
    { href: "/driver/shipments", label: "Assigned Shipments" },
    { href: "/driver/routes", label: "My Routes" },
    { href: "/driver/history", label: "Delivery History" },
    { href: "/driver/earnings", label: "Compensation" },
    { href: "/driver/availability", label: "Availability" },
    { href: "/driver/profile", label: "Profile" },
    { href: "/account/support", label: "Support" },
  ];
  return <DashboardShell title="Driver" nav={nav} user={{ name: u.fullName ?? u.email, roleLabel: "Driver" }}>{children}</DashboardShell>;
}
