// Server-only Stripe access, built for the Cloudflare Workers runtime
// (fetch HTTP client + WebCrypto signature verification). Billing is
// optional: until the secrets exist, isStripeConfigured() is false and the
// settings page says so instead of erroring.

import Stripe from "stripe";

export function stripeEnv() {
  return {
    secretKey: process.env["STRIPE_SECRET_KEY"] ?? "",
    priceId: process.env["STRIPE_PRICE_ID"] ?? "",
    annualPriceId: process.env["STRIPE_PRICE_ID_ANNUAL"] ?? "",
    premiumPriceId: process.env["STRIPE_PRICE_ID_PREMIUM"] ?? "",
    premiumAnnualPriceId: process.env["STRIPE_PRICE_ID_PREMIUM_ANNUAL"] ?? "",
    // The Office plan (internally "team"): one flat price, quantity 1.
    teamPriceId: process.env["STRIPE_PRICE_ID_OFFICE"] ?? "",
    teamAnnualPriceId: process.env["STRIPE_PRICE_ID_OFFICE_ANNUAL"] ?? "",
    // One-off top-up packs (plans.ts TOPUP_PACKS); STRIPE_PRICE_ID_TOPUP is the
    // older name for the small pack.
    topupPriceIds: {
      small:
        process.env["STRIPE_PRICE_ID_TOPUP_SMALL"] ?? process.env["STRIPE_PRICE_ID_TOPUP"] ?? "",
      large: process.env["STRIPE_PRICE_ID_TOPUP_LARGE"] ?? "",
    },
    webhookSecret: process.env["STRIPE_WEBHOOK_SECRET"] ?? "",
  };
}

export function isStripeConfigured(): boolean {
  const { secretKey, priceId } = stripeEnv();
  return !!secretKey && !!priceId;
}

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const { secretKey } = stripeEnv();
  if (!secretKey) throw new Error("Billing isn't configured yet.");
  if (!_stripe) {
    _stripe = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return _stripe;
}

export function webhookCryptoProvider() {
  return Stripe.createSubtleCryptoProvider();
}
