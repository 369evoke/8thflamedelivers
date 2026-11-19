import { describe, expect, it } from "vitest";
import { generateTrackingNumber, isValidTrackingNumber, luhnCheckDigit } from "@/lib/identifiers";
import { bookingSchema, checkPackages, normalizePostal } from "@/lib/validation";
import { hashToken, verifyToken } from "@/lib/tokens";
import { maskName, toPublicTracking } from "@/lib/tracking";

describe("tracking numbers", () => {
  it("generates valid, unique numbers with a check digit", () => {
    const set = new Set(Array.from({ length: 2000 }, generateTrackingNumber));
    expect(set.size).toBe(2000);
    for (const t of set) expect(isValidTrackingNumber(t)).toBe(true);
  });
  it("rejects typos", () => {
    const t = generateTrackingNumber();
    const bad = t.slice(0, -1) + String((Number(t.at(-1)) + 1) % 10);
    expect(isValidTrackingNumber(bad)).toBe(false);
    expect(luhnCheckDigit("7992739871")).toBe(3);
  });
});

describe("booking validation", () => {
  const limits = { max_weight_kg: 30, max_length_cm: 150, max_girth_cm: 300, max_packages: 25 };
  const pkg = { package_type: "Small box" as const, description: "Books", quantity: 1, weight_kg: 2, length_cm: 30, width_cm: 20, height_cm: 10, special_handling: [] };
  it("blocks restricted items and over-limit packages", () => {
    expect(checkPackages([{ ...pkg, description: "Fireworks for party" }], limits, ["fireworks"])).toHaveLength(1);
    expect(checkPackages([{ ...pkg, weight_kg: 50 }], limits, [])[0]).toMatch(/30 kg/);
    expect(checkPackages([{ ...pkg, quantity: 30 }], limits, [])[0]).toMatch(/at most 25/);
    expect(checkPackages([pkg], limits, ["fireworks"])).toEqual([]);
  });
  it("normalizes and validates Canadian postal codes", () => {
    expect(normalizePostal("m5v3l9")).toBe("M5V 3L9");
    const addr = { name: "Jo Smith", phone: "416-555-0100", email: "jo@example.com", street: "1 King St", city: "Toronto", province: "ON", postal: "m5v3l9" };
    const base = { sender: addr, recipient: { ...addr, email: "" }, pickup_date: "2030-01-01", pickup_window: "08:00-10:00", packages: [pkg], service_code: "standard", restricted_items_ack: true };
    expect(bookingSchema.safeParse(base).success).toBe(true);
    expect(bookingSchema.safeParse({ ...base, sender: { ...addr, postal: "12345" } }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...base, restricted_items_ack: false }).success).toBe(false);
  });
});

describe("guest tokens", () => {
  it("verifies only the original token", () => {
    const h = hashToken("abc123");
    expect(verifyToken("abc123", h)).toBe(true);
    expect(verifyToken("abc124", h)).toBe(false);
  });
});

describe("public tracking privacy", () => {
  const s = { tracking_number: "8F000000000000", status: "delivered" as const, service_code: "standard", created_at: "2026-01-01T10:00:00Z", pickup_city: "Toronto", pickup_province: "ON", delivery_city: "Hamilton", delivery_province: "ON", estimated_delivery_date: "2026-01-03", delivered_at: "2026-01-02T15:00:00Z", package_count: 1, payment_status: "paid", sender_name: "Secret Sender", recipient_name: "Secret Recipient", delivery_street: "1 Hidden Rd", sender_phone: "416", recipient_email: "x@y.z" };
  const events = [
    { status: "picked_up" as const, location: "Toronto", notes: null, is_public: true, created_at: "2026-01-01T12:00:00Z" },
    { status: "exception" as const, location: null, notes: "internal stuff", is_public: false, created_at: "2026-01-01T13:00:00Z", internal_notes: "secret" },
    { status: "delivered" as const, location: "Hamilton", notes: null, is_public: true, created_at: "2026-01-02T15:00:00Z", pod_recipient_name: "Secret Recipient" },
  ];
  it("exposes no names, addresses, phones or internal events", () => {
    const t = toPublicTracking(s, events);
    const json = JSON.stringify(t);
    for (const secret of ["Secret", "Hidden", "416", "x@y.z", "internal"]) expect(json).not.toContain(secret);
    expect(t.events).toHaveLength(2);
    expect(t.events[1].signed_by).toBe("S. R.");
    expect(t.destination).toBe("Hamilton, ON");
  });
  it("masks names to initials", () => expect(maskName("ada lovelace")).toBe("A. L."));
});
