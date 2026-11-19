import { describe, expect, it } from "vitest";
import { billableWeightKg, calculatePrice, estimateRoadKm, PricingError, type PricingContext, type ServiceRate } from "@/lib/pricing";

const svc: ServiceRate = { code: "standard", name: "Standard Delivery", base_price_cents: 900, per_km_cents: 45, per_kg_cents: 40, included_kg: 5, min_charge_cents: 1100, surcharge_cents: 0, max_distance_km: 600 };
const ctx: PricingContext = { dimDivisor: 5000, handlingFees: { fragile: { label: "Fragile handling", amount_cents: 500 } }, taxRatePercent: 13, taxLabel: "HST (ON)", areaMultiplier: 1, laneSurchargeCents: 0, businessDiscountPercent: 0, promo: null };
const box = { quantity: 1, weight_kg: 2, length_cm: 30, width_cm: 20, height_cm: 15, special_handling: [] as string[] };

describe("pricing engine", () => {
  it("uses the greater of actual and dimensional weight", () => {
    expect(billableWeightKg([{ ...box, weight_kg: 1, length_cm: 50, width_cm: 50, height_cm: 50 }], 5000)).toEqual({ actual: 1, billable: 25 });
    expect(billableWeightKg([{ ...box, quantity: 3 }], 5000)).toEqual({ actual: 6, billable: 6 });
  });

  it("builds an itemized, taxed total in integer cents", () => {
    const p = calculatePrice(svc, 20, [box], ctx);
    // 900 base + 20km*45 = 900 → 1800 subtotal; no weight charge (2kg < 5 included)
    expect(p.subtotal_cents).toBe(1800);
    expect(p.tax_cents).toBe(234);
    expect(p.total_cents).toBe(2034);
    expect(p.lines.map((l) => l.label)).toContain("Distance (20 km)");
  });

  it("applies minimum charge", () => {
    const p = calculatePrice(svc, 1, [box], ctx);
    expect(p.subtotal_cents).toBe(1100);
    expect(p.lines.at(-1)?.label).toBe("Minimum charge adjustment");
  });

  it("charges weight over the included allowance and handling per package", () => {
    const p = calculatePrice(svc, 10, [{ ...box, weight_kg: 8, quantity: 2, special_handling: ["fragile"] }], ctx);
    // billable 16kg → 11kg * 40 = 440; fragile 2 × 500
    expect(p.lines.find((l) => l.label.startsWith("Weight"))?.amount_cents).toBe(440);
    expect(p.lines.find((l) => l.label.startsWith("Fragile"))?.amount_cents).toBe(1000);
  });

  it("stacks business discount then promo, never below zero", () => {
    const p = calculatePrice(svc, 20, [box], { ...ctx, businessDiscountPercent: 10, promo: { code: "X", percent_off: 50, amount_off_cents: null } });
    expect(p.discount_cents).toBe(180 + 810);
    const big = calculatePrice(svc, 20, [box], { ...ctx, promo: { code: "Y", percent_off: null, amount_off_cents: 999999 } });
    expect(big.total_cents).toBe(0);
  });

  it("applies area multiplier and lane surcharge", () => {
    const p = calculatePrice(svc, 20, [box], { ...ctx, areaMultiplier: 1.1, laneSurchargeCents: 500 });
    expect(p.subtotal_cents).toBe(Math.round(2300 * 1.1));
  });

  it("rejects routes beyond the service limit and empty shipments", () => {
    expect(() => calculatePrice(svc, 700, [box], ctx)).toThrow(PricingError);
    expect(() => calculatePrice(svc, 10, [], ctx)).toThrow(PricingError);
  });

  it("estimates road distance between Toronto and Mississauga sensibly", () => {
    const km = estimateRoadKm({ lat: 43.651, lng: -79.383 }, { lat: 43.589, lng: -79.6441 });
    expect(km).toBeGreaterThan(20);
    expect(km).toBeLessThan(40);
  });
});
