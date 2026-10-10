import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { monthlyLimit, normalizePlan, USAGE_KINDS, type UsageKind } from "./plans";

// Billing server functions. SDK and admin imports stay inside handlers —
// this file ships to the client bundle.

const FALLBACK_ORIGIN = "https://contactkickstart.com";

function requestOrigin(): string {
  const req = getRequest();
  const origin = req?.headers.get("origin");
  if (origin && /^https:\/\//.test(origin)) return origin;
  try {
    const ref = req?.headers.get("referer");
    if (ref) return new URL(ref).origin;
  } catch {
    // Fall through.
  }
  return FALLBACK_ORIGIN;
}

export type BillingState = {
  plan: "free" | "pro";
  stripeConfigured: boolean;
  usage: Record<UsageKind, { used: number; limit: number | null }>; // null limit = unlimited
};

/** Plan + this month's usage for the settings page. */
export const getBillingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingState> => {
    const { getPlan, countUsageThisMonth } = await import("./usage.server");
    const { isStripeConfigured } = await import("./stripe.server");
    const plan = await getPlan(context.userId);
    const counts = await Promise.all(
      USAGE_KINDS.map((k) => countUsageThisMonth(context.userId, k)),
    );
    const usage = Object.fromEntries(
      USAGE_KINDS.map((k, i) => {
        const limit = monthlyLimit(plan, k);
        return [k, { used: counts[i] ?? 0, limit: limit === Infinity ? null : limit }];
      }),
    ) as BillingState["usage"];
    return { plan, stripeConfigured: isStripeConfigured(), usage };
  });

/** Starts a Stripe Checkout subscription for Pro; returns the redirect URL. */
export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStripe, isStripeConfigured, stripeEnv } = await import("./stripe.server");
    if (!isStripeConfigured()) {
      throw new Error("Billing isn't configured yet — add the Stripe secrets first.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, stripe_customer_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (normalizePlan(profile?.plan) === "pro") throw new Error("You're already on Pro.");

    const origin = requestOrigin();
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : undefined;
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: stripeEnv().priceId, quantity: 1 }],
      client_reference_id: context.userId,
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : email
          ? { customer_email: email }
          : {}),
      allow_promotion_codes: true,
      success_url: `${origin}/app/settings?billing=success`,
      cancel_url: `${origin}/app/settings?billing=cancelled`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout link. Try again.");
    return { url: session.url };
  });

/** Opens the Stripe billing portal so Pro users can manage or cancel. */
export const createBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getStripe, isStripeConfigured } = await import("./stripe.server");
    if (!isStripeConfigured()) throw new Error("Billing isn't configured yet.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.stripe_customer_id) throw new Error("No billing account found for this login.");
    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${requestOrigin()}/app/settings`,
    });
    return { url: session.url };
  });
