import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { env, integrations } from "@/lib/env";
import { markShipmentPaid } from "@/lib/shipment-service";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyStaff } from "@/lib/notify";

/** The ONLY place a card payment is marked as paid. Signature is verified against the raw body. */
export async function POST(req: Request) {
  if (!integrations.stripe()) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, env.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.payment_status !== "paid") break; // async methods complete later
        const shipmentId = s.metadata?.shipment_id;
        if (shipmentId) await markShipmentPaid(shipmentId, s.id, typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null, s.amount_total ?? 0);
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const s = event.data.object as Stripe.Checkout.Session;
        const status = event.type === "checkout.session.expired" ? "failed" : "failed";
        await admin.from("payments").update({ status, failure_reason: event.type }).eq("stripe_checkout_session_id", s.id).neq("status", "paid");
        if (s.metadata?.shipment_id) {
          await admin.from("shipments").update({ payment_status: "failed" }).eq("id", s.metadata.shipment_id).neq("payment_status", "paid");
          if (event.type === "checkout.session.async_payment_failed") await notifyStaff("staff.payment_failed", `Payment failed for ${s.metadata.tracking_number}`, ["The customer's payment did not complete."]);
        }
        break;
      }
      case "charge.refunded": {
        const c = event.data.object as Stripe.Charge;
        const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
        if (pi) {
          const full = c.amount_refunded >= c.amount;
          const { data: pay } = await admin.from("payments").update({ status: full ? "refunded" : "partially_refunded" }).eq("stripe_payment_intent_id", pi).select("shipment_id").maybeSingle();
          if (pay?.shipment_id) await admin.from("shipments").update({ payment_status: full ? "refunded" : "partially_refunded" }).eq("id", pay.shipment_id);
        }
        break;
      }
    }
  } catch (e) {
    console.error("[stripe webhook]", e);
    return NextResponse.json({ error: "Handler error" }, { status: 500 }); // Stripe will retry
  }
  return NextResponse.json({ received: true });
}
