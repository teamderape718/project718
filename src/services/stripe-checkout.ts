import Stripe from "stripe";
import { loadEnv } from "../config/env.js";

export function getStripe(): Stripe | null {
  const secret = loadEnv().STRIPE_SECRET_KEY?.trim();
  if (!secret) return null;
  return new Stripe(secret, { typescript: true });
}

/** Base URL for opening a PaymentIntent in the Stripe Dashboard (test vs live from secret key). */
export function stripePaymentsDashboardBase(): string | null {
  const secret = loadEnv().STRIPE_SECRET_KEY?.trim();
  if (!secret) return null;
  if (secret.startsWith("sk_test_")) return "https://dashboard.stripe.com/test/payments";
  if (secret.startsWith("sk_live_")) return "https://dashboard.stripe.com/payments";
  return "https://dashboard.stripe.com/payments";
}

export async function createMerchCheckoutSession(params: {
  stripePriceId: string;
  merchId: number;
  merchName: string;
  quantity: number;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured");
  const env = loadEnv();
  const base = env.PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: params.stripePriceId,
        quantity: Math.min(99, Math.max(1, params.quantity)),
      },
    ],
    success_url: `${base}/merch?checkout=success`,
    cancel_url: `${base}/merch?checkout=cancel`,
    metadata: {
      merch_id: String(params.merchId),
      merch_name: params.merchName.slice(0, 500),
    },
    phone_number_collection: { enabled: true },
    billing_address_collection: "required",
  });
  return session;
}
