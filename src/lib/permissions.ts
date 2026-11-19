export const ROLES = [
  "customer",
  "driver",
  "super_admin",
  "operations_manager",
  "dispatcher",
  "support",
  "finance",
] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: Role[] = ["super_admin", "operations_manager", "dispatcher", "support", "finance"];

export const ROLE_LABELS: Record<Role, string> = {
  customer: "Customer",
  driver: "Driver",
  super_admin: "Super Administrator",
  operations_manager: "Operations Manager",
  dispatcher: "Dispatcher",
  support: "Customer Support",
  finance: "Finance",
};

export type Permission =
  | "shipments.view_all"
  | "shipments.confirm"
  | "shipments.update_status"
  | "shipments.cancel"
  | "shipments.notes"
  | "dispatch.assign"
  | "dispatch.routes"
  | "drivers.manage"
  | "drivers.applications"
  | "businesses.manage"
  | "customers.view"
  | "customers.manage"
  | "pricing.manage"
  | "services.manage"
  | "areas.manage"
  | "payments.view"
  | "payments.refund"
  | "invoices.manage"
  | "promos.manage"
  | "support.manage"
  | "reports.view"
  | "settings.manage"
  | "employees.manage"
  | "audit.view";

const ALL: Permission[] = [
  "shipments.view_all", "shipments.confirm", "shipments.update_status", "shipments.cancel", "shipments.notes",
  "dispatch.assign", "dispatch.routes", "drivers.manage", "drivers.applications", "businesses.manage",
  "customers.view", "customers.manage", "pricing.manage", "services.manage", "areas.manage", "payments.view",
  "payments.refund", "invoices.manage", "promos.manage", "support.manage", "reports.view", "settings.manage",
  "employees.manage", "audit.view",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: [],
  driver: [],
  super_admin: ALL,
  operations_manager: ALL.filter((p) => !["employees.manage", "payments.refund", "settings.manage"].includes(p)),
  dispatcher: [
    "shipments.view_all", "shipments.confirm", "shipments.update_status", "shipments.notes",
    "dispatch.assign", "dispatch.routes", "customers.view",
  ],
  support: ["shipments.view_all", "shipments.notes", "customers.view", "support.manage"],
  finance: ["shipments.view_all", "payments.view", "payments.refund", "invoices.manage", "reports.view", "customers.view"],
};

export function hasPermission(role: Role | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function isStaff(role: Role | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/** Roles a given role may grant when creating employees. Only super admins can create staff. */
export function assignableRoles(role: Role): Role[] {
  return role === "super_admin" ? ["super_admin", "operations_manager", "dispatcher", "support", "finance"] : [];
}
