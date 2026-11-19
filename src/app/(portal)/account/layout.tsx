import { DashboardShell } from "@/components/dashboard/Shell";
import { requireUser } from "@/lib/auth";
import { isStaff, ROLE_LABELS } from "@/lib/permissions";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser("/account");
  const nav = [
    { href: "/account", label: "Overview" },
    { href: "/ship", label: "Ship a Package" },
    { href: "/account/shipments", label: "My Shipments" },
    { href: "/track", label: "Track Shipment" },
    { href: "/account/addresses", label: "Saved Addresses" },
    { href: "/account/payments", label: "Payment History & Receipts" },
    { href: "/account/notifications", label: "Notifications" },
    { href: "/account/support", label: "Support" },
    { href: "/account/settings", label: "Account Settings" },
  ];
  if (u.businesses.some((b) => b.status === "approved")) nav.push({ href: "/business/portal", label: "→ Business portal" });
  if (u.driverId) nav.push({ href: "/driver", label: "→ Driver portal" });
  if (isStaff(u.role)) nav.push({ href: "/admin", label: "→ Admin" });
  return <DashboardShell title="My account" nav={nav} user={{ name: u.fullName ?? u.email, roleLabel: ROLE_LABELS[u.role] }}>{children}</DashboardShell>;
}
