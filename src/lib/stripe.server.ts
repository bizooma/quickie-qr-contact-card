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
    teamPriceId: process.env["STRIPE_PRICE_ID_TEAM"] ?? "",
    teamAnnualPriceId: process.env["STRIPE_PRICE_ID_TEAM_ANNUAL"] ?? "",
    topupPriceId: process.env["STRIPE_PRICE_ID_TOPUP"] ?? "", // one-off scan pack
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
