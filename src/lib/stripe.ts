import "server-only";
import Stripe from "stripe";
import { env, integrations } from "@/lib/env";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!integrations.stripe()) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET).");
  client ??= new Stripe(env.stripeSecret);
  return client;
}
