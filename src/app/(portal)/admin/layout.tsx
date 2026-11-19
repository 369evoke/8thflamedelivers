import { DashboardShell } from "@/components/dashboard/Shell";
import { requireStaffPage } from "@/lib/auth";
import { hasPermission, ROLE_LABELS, type Permission } from "@/lib/permissions";

const NAV: [string, string, Permission | null][] = [
  ["/admin", "Dashboard", null],
  ["/admin/shipments", "Shipments", "shipments.view_all"],
  ["/dispatch", "Dispatch", "dispatch.assign"],
  ["/dispatch/routes", "Routes", "dispatch.routes"],
  ["/admin/customers", "Customers", "customers.view"],
  ["/admin/drivers", "Drivers", "drivers.manage"],
  ["/admin/driver-applications", "Driver Applications", "drivers.applications"],
  ["/admin/businesses", "Business Accounts", "businesses.manage"],
  ["/admin/services", "Shipping Services", "services.manage"],
  ["/admin/pricing", "Pricing Management", "pricing.manage"],
  ["/admin/service-areas", "Service Areas", "areas.manage"],
  ["/admin/labels", "Shipping Labels", "shipments.view_all"],
  ["/admin/payments", "Payments", "payments.view"],
  ["/admin/invoices", "Invoices", "invoices.manage"],
  ["/admin/discounts", "Discounts", "promos.manage"],
  ["/admin/notifications", "Notifications", "audit.view"],
  ["/admin/support", "Customer Support", "support.manage"],
  ["/admin/reports", "Reports & Analytics", "reports.view"],
  ["/admin/website", "Website Management", "settings.manage"],
  ["/admin/employees", "Employee Management", "employees.manage"],
  ["/admin/settings", "Settings", "pricing.manage"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await requireStaffPage();
  const nav = NAV.filter(([, , p]) => !p || hasPermission(u.role, p)).map(([href, label]) => ({ href, label }));
  return <DashboardShell title="Administration" nav={nav} user={{ name: u.fullName ?? u.email, roleLabel: ROLE_LABELS[u.role] }}>{children}</DashboardShell>;
}
