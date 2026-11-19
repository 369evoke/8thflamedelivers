import { z } from "zod";

export const PROVINCES = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"],
  ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"],
  ["SK", "Saskatchewan"], ["YT", "Yukon"],
] as const;
const provinceCodes = PROVINCES.map((p) => p[0]) as [string, ...string[]];

export const HANDLING_OPTIONS = [
  ["fragile", "Fragile"],
  ["signature_required", "Signature required"],
  ["oversized", "Oversized"],
  ["keep_upright", "Keep upright"],
] as const;

export const PACKAGE_TYPES = ["Envelope", "Small box", "Medium box", "Large box", "Tube", "Bag", "Pallet-free bundle"] as const;

export function normalizePostal(v: string) {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 6 ? `${s.slice(0, 3)} ${s.slice(3)}` : v.toUpperCase().trim();
}

const postal = z
  .string()
  .transform(normalizePostal)
  .refine((v) => /^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z] [0-9][ABCEGHJ-NPRSTV-Z][0-9]$/.test(v), "Enter a valid Canadian postal code");

const phone = z
  .string()
  .trim()
  .refine((v) => v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 11, "Enter a valid phone number");

const text = (max: number, min = 1) => z.string().trim().min(min, "Required").max(max);
const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null);

export const addressSchema = z.object({
  name: text(120, 2),
  phone,
  email: z.string().trim().email("Enter a valid email").max(200),
  street: text(200, 3),
  unit: optText(30),
  city: text(80, 2),
  province: z.enum(provinceCodes),
  postal,
  instructions: optText(500),
});

export const recipientSchema = addressSchema.extend({
  email: z.string().trim().email().max(200).optional().or(z.literal("")).transform((v) => v || null),
});

export const packageSchema = z.object({
  package_type: z.enum(PACKAGE_TYPES),
  description: text(300, 3),
  quantity: z.coerce.number().int().min(1).max(100),
  weight_kg: z.coerce.number().positive("Weight must be greater than 0").max(1000),
  length_cm: z.coerce.number().positive().max(1000),
  width_cm: z.coerce.number().positive().max(1000),
  height_cm: z.coerce.number().positive().max(1000),
  special_handling: z.array(z.enum(HANDLING_OPTIONS.map((h) => h[0]) as [string, ...string[]])).default([]),
  declared_value: z.coerce.number().min(0).max(100000).optional(),
});

export const quoteSchema = z.object({
  pickup: z.object({ city: z.string().trim().min(2), province: z.enum(provinceCodes), postal }),
  delivery: z.object({ city: z.string().trim().min(2), province: z.enum(provinceCodes), postal }),
  packages: z.array(packageSchema).min(1).max(25),
  service_code: z.string().regex(/^[a-z_]+$/).optional(),
  promo_code: z.string().trim().toUpperCase().max(40).optional().or(z.literal("")),
  business_id: z.string().uuid().optional(),
});

export const bookingSchema = z.object({
  sender: addressSchema,
  recipient: recipientSchema,
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickup_window: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
  packages: z.array(packageSchema).min(1).max(25),
  service_code: z.string().regex(/^[a-z_]+$/),
  promo_code: z.string().trim().toUpperCase().max(40).optional().or(z.literal("")),
  business_id: z.string().uuid().optional(),
  billing_method: z.enum(["card", "invoice"]).default("card"),
  restricted_items_ack: z.literal(true, { message: "You must confirm the shipment contains no restricted items" }),
  guest_email: z.string().email().optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type PackageForm = z.input<typeof packageSchema>;

export interface PackageLimits {
  max_weight_kg: number;
  max_length_cm: number;
  max_girth_cm: number;
  max_packages: number;
}

/** Returns a list of human-readable problems; empty list means OK. */
export function checkPackages(
  pkgs: z.infer<typeof packageSchema>[],
  limits: PackageLimits,
  restrictedKeywords: string[],
): string[] {
  const errors: string[] = [];
  const total = pkgs.reduce((s, p) => s + p.quantity, 0);
  if (total > limits.max_packages) errors.push(`A shipment may contain at most ${limits.max_packages} packages.`);
  pkgs.forEach((p, i) => {
    const n = `Package ${i + 1}`;
    if (p.weight_kg > limits.max_weight_kg) errors.push(`${n}: exceeds the ${limits.max_weight_kg} kg weight limit.`);
    const longest = Math.max(p.length_cm, p.width_cm, p.height_cm);
    const dims = [p.length_cm, p.width_cm, p.height_cm].sort((a, b) => b - a);
    const girth = dims[0] + 2 * (dims[1] + dims[2]);
    if (longest > limits.max_length_cm) errors.push(`${n}: longest side exceeds ${limits.max_length_cm} cm.`);
    if (girth > limits.max_girth_cm) errors.push(`${n}: length + girth exceeds ${limits.max_girth_cm} cm.`);
    const desc = p.description.toLowerCase();
    const hit = restrictedKeywords.find((k) => desc.includes(k.toLowerCase()));
    if (hit) errors.push(`${n}: "${hit}" is a restricted item and cannot be shipped with 8th Flame Delivery.`);
  });
  return errors;
}

export const driverApplicationSchema = z.object({
  full_name: text(120, 2),
  email: z.string().trim().email().max(200),
  phone,
  address: text(200, 3),
  city: text(80, 2),
  province: z.enum(provinceCodes),
  vehicle_type: z.enum(["Car", "Minivan", "Cargo van", "Box truck", "Pickup truck"]),
  vehicle_info: optText(300),
  experience_years: z.coerce.number().int().min(0).max(60),
  availability: text(500, 2),
  qualifications: optText(1000),
  consent: z.literal("on", { message: "Consent is required" }),
});

export const businessApplicationSchema = z.object({
  name: text(160, 2),
  email: z.string().trim().email().max(200),
  contact_name: text(120, 2),
  phone,
  address: text(200, 3),
  city: text(80, 2),
  province: z.enum(provinceCodes),
  business_type: z.enum(["Retailer", "Online store", "Wholesaler", "Corporate", "Healthcare", "Other"]),
  estimated_monthly_volume: z.coerce.number().int().min(0).max(1_000_000),
});

export const contactSchema = z.object({
  name: text(120, 2),
  email: z.string().trim().email().max(200),
  category: z.enum(["missing_shipment", "delayed_shipment", "billing", "damage", "general", "business", "driver"]),
  tracking_number: z.string().trim().max(20).optional().or(z.literal("")),
  subject: text(200, 3),
  message: text(5000, 10),
});
