import { DashboardShell } from "@/components/dashboard/Shell";
import { requireBusinessPage } from "@/lib/auth";

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = await requireBusinessPage();
  const nav = [
    { href: "/business/portal", label: "Overview" },
    { href: "/business/portal/create", label: "Create Shipment" },
    { href: "/business/portal/bulk", label: "Bulk Shipping" },
    { href: "/business/portal/shipments", label: "Shipment History" },
    { href: "/business/portal/labels", label: "Shipping Labels" },
    { href: "/business/portal/invoices", label: "Invoices" },
    { href: "/business/portal/addresses", label: "Saved Addresses" },
    { href: "/business/portal/team", label: "Team Members" },
    { href: "/business/portal/settings", label: "Account Settings" },
    { href: "/account/support", label: "Support" },
    { href: "/account", label: "→ Personal account" },
  ];
  return <DashboardShell title={business.name} nav={nav} user={{ name: user.fullName ?? user.email, roleLabel: `Business ${business.member_role}` }}>{children}</DashboardShell>;
}
