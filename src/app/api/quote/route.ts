import { NextResponse } from "next/server";
import { quoteSchema, checkPackages } from "@/lib/validation";
import { buildQuotes, loadSettings } from "@/lib/quote-service";
import { PricingError } from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/auth";
import { integrations } from "@/lib/env";

export async function POST(req: Request) {
  if (!integrations.supabase()) return NextResponse.json({ error: "Quoting is not configured yet." }, { status: 503 });
  if (!(await rateLimit("quote", 30, 60_000)).ok) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

  const parsed = quoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check your details.", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  const q = parsed.data;

  const settings = await loadSettings();
  const problems = checkPackages(q.packages, settings.limits, settings.restricted);
  if (problems.length) return NextResponse.json({ error: "Please fix the package details.", details: problems }, { status: 422 });

  let businessId: string | null = null;
  if (q.business_id) {
    const user = await getSessionUser();
    if (user?.businesses.some((b) => b.id === q.business_id && b.status === "approved")) businessId = q.business_id;
  }

  try {
    const r = await buildQuotes({ pickup: q.pickup, delivery: q.delivery, packages: q.packages, promoCode: q.promo_code || null, businessId, serviceCode: q.service_code });
    return NextResponse.json({
      distance_km: r.distance.km,
      distance_source: r.distance.source,
      route: { from: r.lane.pickupArea.name, to: r.lane.deliveryArea.name },
      promo_applied: r.promoApplied,
      invoicing_available: !!r.business?.invoicing_enabled,
      options: r.options.map((o) => ({
        code: o.service.code,
        name: o.service.name,
        description: o.service.description,
        same_day: o.service.same_day,
        transit_days: Math.max(o.service.transit_days, r.lane.transitDays),
        price: o.price,
        error: o.error,
      })),
    });
  } catch (e) {
    if (e instanceof PricingError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error(e);
    return NextResponse.json({ error: "We couldn't calculate a quote right now." }, { status: 500 });
  }
}
