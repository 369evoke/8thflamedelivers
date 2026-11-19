export const SHIPMENT_STATUSES = [
  "shipment_created",
  "awaiting_confirmation",
  "confirmed",
  "pickup_scheduled",
  "driver_assigned",
  "driver_en_route_pickup",
  "picked_up",
  "at_processing_facility",
  "in_transit",
  "at_destination_facility",
  "out_for_delivery",
  "delivered",
  "delivery_attempted",
  "delayed",
  "exception",
  "returned_to_sender",
  "cancelled",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  shipment_created: "Shipment Created",
  awaiting_confirmation: "Awaiting Confirmation",
  confirmed: "Confirmed",
  pickup_scheduled: "Pickup Scheduled",
  driver_assigned: "Driver Assigned",
  driver_en_route_pickup: "Driver En Route to Pickup",
  picked_up: "Package Picked Up",
  at_processing_facility: "At Processing Facility",
  in_transit: "In Transit",
  at_destination_facility: "At Destination Facility",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  delivery_attempted: "Delivery Attempted",
  delayed: "Delayed",
  exception: "Exception",
  returned_to_sender: "Returned to Sender",
  cancelled: "Cancelled",
};

export const TERMINAL_STATUSES: ShipmentStatus[] = ["delivered", "returned_to_sender", "cancelled"];
export const ACTIVE_STATUSES: ShipmentStatus[] = SHIPMENT_STATUSES.filter(
  (s) => !TERMINAL_STATUSES.includes(s) && s !== "shipment_created",
);
export const PROBLEM_STATUSES: ShipmentStatus[] = ["delayed", "exception", "delivery_attempted"];

/** Which statuses may follow which. Staff overrides still go through this map. */
export const TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  shipment_created: ["awaiting_confirmation", "cancelled"],
  awaiting_confirmation: ["confirmed", "cancelled"],
  confirmed: ["pickup_scheduled", "driver_assigned", "cancelled", "delayed"],
  pickup_scheduled: ["driver_assigned", "cancelled", "delayed"],
  driver_assigned: ["driver_en_route_pickup", "picked_up", "pickup_scheduled", "delayed", "exception", "cancelled"],
  driver_en_route_pickup: ["picked_up", "delayed", "exception"],
  picked_up: ["at_processing_facility", "in_transit", "out_for_delivery", "delayed", "exception"],
  at_processing_facility: ["in_transit", "out_for_delivery", "delayed", "exception"],
  in_transit: ["at_destination_facility", "out_for_delivery", "delayed", "exception"],
  at_destination_facility: ["out_for_delivery", "delayed", "exception"],
  out_for_delivery: ["delivered", "delivery_attempted", "delayed", "exception"],
  delivery_attempted: ["out_for_delivery", "at_destination_facility", "returned_to_sender", "exception"],
  delayed: ["pickup_scheduled", "driver_assigned", "picked_up", "in_transit", "out_for_delivery", "exception", "cancelled"],
  exception: ["pickup_scheduled", "driver_assigned", "at_processing_facility", "in_transit", "out_for_delivery", "returned_to_sender", "cancelled"],
  delivered: [],
  returned_to_sender: [],
  cancelled: [],
};

/** Statuses a driver may set on an assigned shipment from the driver app. */
export const DRIVER_SETTABLE: ShipmentStatus[] = [
  "driver_en_route_pickup",
  "picked_up",
  "at_processing_facility",
  "in_transit",
  "at_destination_facility",
  "out_for_delivery",
  "delivered",
  "delivery_attempted",
  "delayed",
  "exception",
];

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isShipmentStatus(v: unknown): v is ShipmentStatus {
  return typeof v === "string" && (SHIPMENT_STATUSES as readonly string[]).includes(v);
}

export function statusTone(s: ShipmentStatus): "neutral" | "gold" | "success" | "warning" | "danger" {
  if (s === "delivered") return "success";
  if (s === "cancelled" || s === "returned_to_sender" || s === "exception") return "danger";
  if (s === "delayed" || s === "delivery_attempted") return "warning";
  if (s === "shipment_created" || s === "awaiting_confirmation") return "neutral";
  return "gold";
}
