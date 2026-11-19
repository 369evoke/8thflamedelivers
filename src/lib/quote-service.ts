import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { drivingDistanceKm } from "@/lib/maps";
import { calculatePrice, PricingError, type PackageInput, type PriceBreakdown, type ServiceRate } from "@/lib/pricing";
import type { PackageLimits } from "@/lib/validation";

export interface AreaRow {
  id: string;
  name: string;
  city: string;
  province: string;
  postal_prefixes: string[];
  center_lat: number | null;
  center_lng: number | null;
  service_codes: string[];
  price_multiplier: number;
}

export interface Lane {
  pickupArea: AreaRow;
  deliveryArea: AreaRow;
  allowedServices: string[];
  laneSurchargeCents: number;
  transitDays: number;
}

export async function loadSettings() {
  const { data } = await createAdminClient().from("platform_settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    limits: (map.package_limits ?? { max_weight_kg: 30, max_length_cm: 150, max_girth_cm: 300, max_packages: 25 }) as PackageLimits,
    restricted: ((map.restricted_items?.keywords as string[]) ?? []).filter(Boolean),
    pickupWindows: (map.pickup_windows as string[]) ?? [],
    cancellable: ((map.cancellation_policy?.cancellable_statuses as string[]) ?? []),
    company: (map.company ?? {}) as { name?: string; support_email?: string; phone?: string; address?: string },
  };
}

export async function findArea(postal: string): Promise<AreaRow | null> {
  const fsa = postal.toUpperCase().replace(/\s/g, "").slice(0, 3);
  const { data } = await createAdminClient()
    .from("service_areas")
    .select("id, name, city, province, postal_prefixes, center_lat, center_lng, service_codes, price_multiplier")
    .eq("is_active", true)
    .contains("postal_prefixes", [fsa])
    .limit(1);
  return (data?.[0] as AreaRow) ?? null;
}

/** Resolves which services are available between two postal codes. */
export async function resolveLane(pickupPostal: string, deliveryPostal: string): Promise<Lane> {
  const [a, b] = await Promise.all([findArea(pickupPostal), findArea(deliveryPostal)]);
  if (!a) throw new PricingError("We don't currently offer pickups at that postal code.");
  if (!b) throw new PricingError("We don't currently deliver to that postal code.");
  if (a.id === b.id) return { pickupArea: a, deliveryArea: b, allowedServices: a.service_codes, laneSurchargeCents: 0, transitDays: 0 };

  const { data: lane } = await createAdminClient()
    .from("area_routes")
    .select("service_codes, surcharge_cents, transit_days")
    .eq("origin_area_id", a.id)
    .eq("destination_area_id", b.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!lane) throw new PricingError(`We don't yet ship from ${a.name} to ${b.name}.`);
  return { pickupArea: a, deliveryArea: b, allowedServices: lane.service_codes, laneSurchargeCents: lane.surcharge_cents, transitDays: lane.transit_days };
}

interface QuoteRequest {
  pickup: { street?: string; city: string; province: string; postal: string };
  delivery: { street?: string; city: string; province: string; postal: string };
  packages: PackageInput[];
  promoCode?: string | null;
  businessId?: string | null;
  serviceCode?: string;
}

export interface QuoteOption {
  service: ServiceRate & { description: string | null; transit_days: number; same_day: boolean };
  price: PriceBreakdown | null;
  error: string | null;
}

export async function buildQuotes(req: QuoteRequest) {
  const admin = createAdminClient();
  const lane = await resolveLane(req.pickup.postal, req.delivery.postal);

  const addr = (x: QuoteRequest["pickup"]) => [x.street, x.city, x.province, x.postal, "Canada"].filter(Boolean).join(", ");
  const center = (r: AreaRow) => (r.center_lat != null && r.center_lng != null ? { lat: r.center_lat, lng: r.center_lng } : null);
  const distance = await drivingDistanceKm(addr(req.pickup), addr(req.delivery), { a: center(lane.pickupArea), b: center(lane.deliveryArea) });
  if (!distance) throw new PricingError("We couldn't calculate the distance for this route. Please contact us for a quote.");

  const [{ data: services }, { data: rules }, business, promo] = await Promise.all([
    admin.from("shipping_services").select("*").eq("is_active", true).order("sort_order"),
    admin.from("pricing_rules").select("*").eq("is_active", true),
    req.businessId
      ? admin.from("businesses").select("id, discount_percent, status, invoicing_enabled").eq("id", req.businessId).eq("status", "approved").maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
    req.promoCode ? loadPromo(req.promoCode) : Promise.resolve(null),
  ]);

  const r = rules ?? [];
  const dimDivisor = Number(r.find((x) => x.rule_type === "dim_divisor")?.numeric_value ?? 5000);
  const handlingFees = Object.fromEntries(
    r.filter((x) => x.rule_type === "handling_fee").map((x) => [x.key, { label: x.label, amount_cents: x.amount_cents ?? 0 }]),
  );
  const tax = r.find((x) => x.rule_type === "tax" && x.key === req.pickup.province);

  const eligible = (services ?? []).filter(
    (s) => lane.allowedServices.includes(s.code) && (!s.business_only || !!business) && (!req.serviceCode || s.code === req.serviceCode),
  );

  const options: QuoteOption[] = eligible.map((s) => {
    try {
      const price = calculatePrice(s, distance.km, req.packages, {
        dimDivisor,
        handlingFees,
        taxRatePercent: Number(tax?.percent ?? 0),
        taxLabel: tax?.label ?? "Tax",
        areaMultiplier: Number(lane.pickupArea.price_multiplier ?? 1),
        laneSurchargeCents: lane.laneSurchargeCents,
        businessDiscountPercent: Number(business?.discount_percent ?? 0),
        promo,
      });
      return { service: s, price, error: null };
    } catch (e) {
      return { service: s, price: null, error: (e as Error).message };
    }
  });

  return {
    lane,
    distance,
    options,
    promoApplied: !!promo,
    business,
    taxConfigured: !!tax,
  };
}

async function loadPromo(code: string) {
  const now = new Date().toISOString();
  const { data } = await createAdminClient().from("promo_codes").select("*").eq("code", code.toUpperCase()).eq("is_active", true).maybeSingle();
  if (!data) return null;
  if (data.valid_from && data.valid_from > now) return null;
  if (data.valid_until && data.valid_until < now) return null;
  if (data.max_redemptions != null && data.times_redeemed >= data.max_redemptions) return null;
  return { code: data.code, percent_off: data.percent_off ? Number(data.percent_off) : null, amount_off_cents: data.amount_off_cents };
}

export function estimateDeliveryDate(pickupDate: string, transitDays: number, sameDay: boolean) {
  const d = new Date(pickupDate + "T12:00:00");
  let add = sameDay ? 0 : Math.max(1, transitDays);
  while (add > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) add--;
  }
  return d.toISOString().slice(0, 10);
}
