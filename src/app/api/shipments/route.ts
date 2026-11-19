import { NextResponse } from "next/server";
import { bookingSchema } from "@/lib/validation";
import { BookingError, createShipment } from "@/lib/shipment-service";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { env, integrations } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  if (!integrations.supabase()) return NextResponse.json({ error: "Booking is not configured yet." }, { status: 503 });
  if (!(await rateLimit("book", 10, 10 * 60_000)).ok) return NextResponse.json({ error: "Too many bookings from this connection. Please try later." }, { status: 429 });

  const parsed = bookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check your details.", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const input = parsed.data;
  const user = await getSessionUser();

  if (input.billing_method === "card" && !integrations.stripe()) {
    return NextResponse.json({ error: "Online payments aren't connected yet, so card bookings can't be completed. Please contact us." }, { status: 503 });
  }

  try {
    const s = await createShipment(input, user);
    await audit(user, "shipment.create", "shipment", s.id, { tracking: s.tracking_number, billing: s.billing });

    if (s.billing === "invoice") {
      return NextResponse.json({ ok: true, tracking_number: s.tracking_number, redirect: `/ship/success?shipment=${s.id}` });
    }

    const stripe = getStripe();
    const tokenParam = s.guestToken ? `&t=${encodeURIComponent(s.guestToken)}` : "";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "cad",
      customer_email: input.sender.email,
      line_items: [{ quantity: 1, price_data: { currency: "cad", unit_amount: s.total_cents, product_data: { name: `8th Flame Delivery shipment ${s.tracking_number}`, description: `Reference ${s.reference}` } } }],
      metadata: { shipment_id: s.id, tracking_number: s.tracking_number },
      payment_intent_data: { metadata: { shipment_id: s.id } },
      success_url: `${env.siteUrl}/ship/success?shipment=${s.id}&session_id={CHECKOUT_SESSION_ID}${tokenParam}`,
      cancel_url: `${env.siteUrl}/ship/cancelled?shipment=${s.id}${tokenParam}`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    });

    await createAdminClient().from("payments").insert({
      shipment_id: s.id,
      profile_id: user?.id ?? null,
      provider: "stripe",
      stripe_checkout_session_id: session.id,
      amount_cents: s.total_cents,
      status: "pending",
    });
    await createAdminClient().from("shipments").update({ payment_status: "pending" }).eq("id", s.id);

    return NextResponse.json({ ok: true, tracking_number: s.tracking_number, redirect: session.url });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message, details: e.details }, { status: 422 });
    console.error("[book]", e);
    return NextResponse.json({ error: "Something went wrong creating your shipment. You have not been charged." }, { status: 500 });
  }
}
