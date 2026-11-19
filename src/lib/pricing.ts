/**
 * Pure pricing engine. All amounts are integer cents. Called only on the server with rates
 * loaded from the database (shipping_services, pricing_rules, service_areas, businesses, promo_codes).
 */

export interface PackageInput {
  quantity: number;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  special_handling: string[];
}

export interface ServiceRate {
  code: string;
  name: string;
  base_price_cents: number;
  per_km_cents: number;
  per_kg_cents: number;
  included_kg: number;
  min_charge_cents: number;
  surcharge_cents: number;
  max_distance_km: number | null;
}

export interface PricingContext {
  dimDivisor: number; // cm³ per kg, e.g. 5000
  handlingFees: Record<string, { label: string; amount_cents: number }>;
  taxRatePercent: number;
  taxLabel: string;
  areaMultiplier: number; // service_areas.price_multiplier of pickup area
  laneSurchargeCents: number; // area_routes.surcharge_cents for intercity lanes
  businessDiscountPercent: number;
  promo?: { code: string; percent_off: number | null; amount_off_cents: number | null } | null;
}

export interface PriceLine {
  label: string;
  amount_cents: number;
}

export interface PriceBreakdown {
  service_code: string;
  service_name: string;
  distance_km: number;
  actual_weight_kg: number;
  billable_weight_kg: number;
  lines: PriceLine[];
  subtotal_cents: number;
  discount_cents: number;
  tax_label: string;
  tax_cents: number;
  total_cents: number;
}

export class PricingError extends Error {}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function billableWeightKg(pkgs: PackageInput[], dimDivisor: number) {
  let actual = 0;
  let billable = 0;
  for (const p of pkgs) {
    const dim = (p.length_cm * p.width_cm * p.height_cm) / dimDivisor;
    actual += p.weight_kg * p.quantity;
    billable += Math.max(p.weight_kg, dim) * p.quantity;
  }
  return { actual: round2(actual), billable: round2(billable) };
}

export function calculatePrice(
  service: ServiceRate,
  distanceKm: number,
  packages: PackageInput[],
  ctx: PricingContext,
): PriceBreakdown {
  if (!packages.length) throw new PricingError("At least one package is required.");
  if (!(distanceKm >= 0)) throw new PricingError("Invalid distance.");
  if (service.max_distance_km && distanceKm > service.max_distance_km) {
    throw new PricingError(`${service.name} is limited to ${service.max_distance_km} km.`);
  }

  const { actual, billable } = billableWeightKg(packages, ctx.dimDivisor);
  const lines: PriceLine[] = [];

  lines.push({ label: `${service.name} base rate`, amount_cents: service.base_price_cents });

  const distanceCents = Math.round(service.per_km_cents * distanceKm);
  if (distanceCents > 0) lines.push({ label: `Distance (${round2(distanceKm)} km)`, amount_cents: distanceCents });

  const chargeableKg = Math.max(0, billable - service.included_kg);
  const weightCents = Math.round(service.per_kg_cents * chargeableKg);
  if (weightCents > 0) {
    lines.push({ label: `Weight (${round2(chargeableKg)} kg over ${service.included_kg} kg included)`, amount_cents: weightCents });
  }

  if (service.surcharge_cents > 0) lines.push({ label: "Service surcharge", amount_cents: service.surcharge_cents });
  if (ctx.laneSurchargeCents > 0) lines.push({ label: "Intercity lane", amount_cents: ctx.laneSurchargeCents });

  const handlingCounts = new Map<string, number>();
  for (const p of packages) for (const h of new Set(p.special_handling)) handlingCounts.set(h, (handlingCounts.get(h) ?? 0) + p.quantity);
  for (const [code, count] of handlingCounts) {
    const fee = ctx.handlingFees[code];
    if (fee && fee.amount_cents > 0) lines.push({ label: `${fee.label} × ${count}`, amount_cents: fee.amount_cents * count });
  }

  let subtotal = lines.reduce((s, l) => s + l.amount_cents, 0);

  if (ctx.areaMultiplier && ctx.areaMultiplier !== 1) {
    const adj = Math.round(subtotal * (ctx.areaMultiplier - 1));
    lines.push({ label: "Area adjustment", amount_cents: adj });
    subtotal += adj;
  }

  if (subtotal < service.min_charge_cents) {
    lines.push({ label: "Minimum charge adjustment", amount_cents: service.min_charge_cents - subtotal });
    subtotal = service.min_charge_cents;
  }

  let discount = 0;
  if (ctx.businessDiscountPercent > 0) discount += Math.round((subtotal * ctx.businessDiscountPercent) / 100);
  if (ctx.promo) {
    if (ctx.promo.percent_off) discount += Math.round(((subtotal - discount) * ctx.promo.percent_off) / 100);
    if (ctx.promo.amount_off_cents) discount += ctx.promo.amount_off_cents;
  }
  discount = Math.min(discount, subtotal);

  const taxable = subtotal - discount;
  const tax = Math.round((taxable * ctx.taxRatePercent) / 100);

  return {
    service_code: service.code,
    service_name: service.name,
    distance_km: round2(distanceKm),
    actual_weight_kg: actual,
    billable_weight_kg: billable,
    lines,
    subtotal_cents: subtotal,
    discount_cents: discount,
    tax_label: ctx.taxLabel,
    tax_cents: tax,
    total_cents: taxable + tax,
  };
}

/** Great-circle distance × road factor. Used only when no maps provider key is configured. */
export function estimateRoadKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * R * Math.asin(Math.sqrt(h));
  return round2(Math.max(straight * 1.3, 2));
}

export function formatCents(cents: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(cents / 100);
}
