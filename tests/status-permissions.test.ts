import { describe, expect, it } from "vitest";
import { canTransition, DRIVER_SETTABLE, SHIPMENT_STATUSES, TRANSITIONS } from "@/lib/status";
import { assignableRoles, hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";

describe("shipment status workflow", () => {
  it("has all 17 statuses and a transition entry for each", () => {
    expect(SHIPMENT_STATUSES).toHaveLength(17);
    SHIPMENT_STATUSES.forEach((s) => expect(TRANSITIONS[s]).toBeDefined());
  });
  it("follows the booking → delivery happy path", () => {
    const path = ["shipment_created", "awaiting_confirmation", "confirmed", "pickup_scheduled", "driver_assigned", "driver_en_route_pickup", "picked_up", "in_transit", "out_for_delivery", "delivered"] as const;
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1], path[i])).toBe(true);
  });
  it("blocks skipping payment/confirmation and leaving terminal states", () => {
    expect(canTransition("shipment_created", "confirmed")).toBe(false);
    expect(canTransition("shipment_created", "delivered")).toBe(false);
    expect(canTransition("delivered", "in_transit")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });
  it("never lets drivers confirm, cancel or assign", () => {
    for (const s of ["confirmed", "cancelled", "driver_assigned", "awaiting_confirmation", "pickup_scheduled"] as const) expect(DRIVER_SETTABLE).not.toContain(s);
  });
});

describe("role permissions", () => {
  it("gives customers and drivers no staff permissions", () => {
    expect(ROLE_PERMISSIONS.customer).toHaveLength(0);
    expect(ROLE_PERMISSIONS.driver).toHaveLength(0);
    expect(hasPermission("customer", "shipments.view_all")).toBe(false);
  });
  it("scopes dispatcher, support and finance", () => {
    expect(hasPermission("dispatcher", "dispatch.assign")).toBe(true);
    expect(hasPermission("dispatcher", "payments.refund")).toBe(false);
    expect(hasPermission("dispatcher", "pricing.manage")).toBe(false);
    expect(hasPermission("support", "support.manage")).toBe(true);
    expect(hasPermission("support", "dispatch.assign")).toBe(false);
    expect(hasPermission("finance", "payments.refund")).toBe(true);
    expect(hasPermission("finance", "dispatch.assign")).toBe(false);
  });
  it("only lets super admins manage employees", () => {
    expect(hasPermission("operations_manager", "employees.manage")).toBe(false);
    expect(assignableRoles("operations_manager")).toEqual([]);
    expect(assignableRoles("super_admin")).toContain("dispatcher");
    expect(hasPermission(null, "reports.view")).toBe(false);
  });
});
