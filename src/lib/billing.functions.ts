import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveAuth } from "@/lib/auth-guard";
import {
  effectivePlan,
  monthlyLimit,
  USAGE_KINDS,
  type PlanId,
  type UsageKind,
  TOPUP_PACKS,
  type TopupPack,
} from "./plans";

// Billing server functions. SDK and admin imports stay inside handlers —
// this file ships to the client bundle.

const FALLBACK_ORIGIN = "https://contactkickstart.com";

// Stripe return URLs only ever point back at our own domains.
const ALLOWED_ORIGINS = new Set([
  "https://contactkickstart.com",
  "https://www.contactkickstart.com",
  "https://contactkickstart.lovable.app",
  "https://id-preview--47eb069c-46a5-4b91-8359-3b044f3e0bde.lovable.app",
]);

function requestOrigin(): string {
  const req = getRequest();
  let origin = req?.headers.get("origin") ?? null;
  if (!origin) {
    try {
      const ref = req?.headers.get("referer");
      if (ref) origin = new URL(ref).origin;
    } catch {
      // Fall through.
    }
  }
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : FALLBACK_ORIGIN;
}

export type BillingState = {
  plan: PlanId;
  stripeConfigured: boolean;
  annualConfigured: boolean;
  premiumConfigured: boolean;
  premiumAnnualConfigured: boolean;
  teamConfigured: boolean;
  teamAnnualConfigured: boolean;
  /** Top-up packs with a Stripe price configured. */
  topupPacks: TopupPack[];
  hasSubscription: boolean;
  /** Referral discount on this person's next new Pro/Premium checkout (0 = none). */
  referralPct: number;
  planExpiresAt: string | null; // a dated plan (Founding Year, comp) ends here
  coveredByTeam: string | null; // Premium comes from a seat on this team
  teamSeats: number; // seats this user has purchased (0 = not a team owner)
  credits: { scan: number; follow_up: number }; // one-time starter-pack credits
  usage: Record<UsageKind, { used: number; limit: number | null }>; // null limit = unlimited
  sharebacksUsed: number | null; // free only: share-backs collected toward FREE_SHAREBACK_LIMIT
};

/** Plan + this month's usage for the settings page. */
export const getBillingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingState> => {
    const { getPlan, countUsageThisMonth, getStarterCredits } = await import("./usage.server");
    const { isStripeConfigured, stripeEnv } = await import("./stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const plan = await getPlan(context.userId);
    const counts = await Promise.all(
      USAGE_KINDS.map((k) => countUsageThisMonth(context.userId, k)),
    );
    const credits = await getStarterCredits(context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_subscription_id, team_seats, plan, plan_expires_at")
      .eq("id", context.userId)
      .maybeSingle();
    // Premium from a team seat (not the user's own plan): name the team so the
    // settings page doesn't offer billing they don't have.
    let coveredByTeam: string | null = null;
    if (
      plan === "premium" &&
      effectivePlan(profile?.plan, profile?.plan_expires_at) !== "premium"
    ) {
      const { data: m } = await supabaseAdmin
        .from("org_members")
        .select("orgs(name)")
        .eq("user_id", context.userId)
        .maybeSingle();
      coveredByTeam = (m as { orgs?: { name?: string } | null } | null)?.orgs?.name ?? "your team";
    }
    // What a new Pro/Premium checkout would take off (subscribers get theirs
    // on each renewal instead). Best-effort: billing still loads without it.
    let referralPct = 0;
    if (!profile?.stripe_subscription_id) {
      try {
        const { referralDiscountFor } = await import("./referral.server");
        referralPct = (await referralDiscountFor(context.userId, true)).pct;
      } catch {
        referralPct = 0;
      }
    }
    let sharebacksUsed: number | null = null;
    if (plan === "free") {
      const { count } = await supabaseAdmin
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("source", "shareback");
      sharebacksUsed = count ?? 0;
    }
    const usage = Object.fromEntries(
      USAGE_KINDS.map((k, i) => {
        const limit = monthlyLimit(plan, k);
        return [k, { used: counts[i] ?? 0, limit: limit === Infinity ? null : limit }];
      }),
    ) as BillingState["usage"];
    return {
      plan,
      stripeConfigured: isStripeConfigured(),
      annualConfigured: isStripeConfigured() && !!stripeEnv().annualPriceId,
      premiumConfigured: isStripeConfigured() && !!stripeEnv().premiumPriceId,
      premiumAnnualConfigured: isStripeConfigured() && !!stripeEnv().premiumAnnualPriceId,
      teamConfigured: isStripeConfigured() && !!stripeEnv().teamPriceId,
      teamAnnualConfigured: isStripeConfigured() && !!stripeEnv().teamAnnualPriceId,
      topupPacks: isStripeConfigured()
        ? (Object.keys(TOPUP_PACKS) as TopupPack[]).filter((p) => !!stripeEnv().topupPriceIds[p])
        : [],
      hasSubscription: !!profile?.stripe_subscription_id,
      referralPct,
      planExpiresAt: profile?.plan_expires_at ?? null,
      coveredByTeam,
      teamSeats: profile?.team_seats ?? 0,
      credits,
      usage,
      sharebacksUsed,
    };
  });

const CheckoutSchema = z.object({
  plan: z.enum(["pro", "premium", "team", "topup"]).default("pro"),
  pack: z.enum(["small", "large"]).default("small"), // top-up only
  interval: z.enum(["month", "year"]).default("month"),
  seats: z.number().int().min(3).max(500).optional(), // team plan only
});

/** Starts a Stripe Checkout — Pro or Premium (monthly/annual, one seat),
 *  Teams (per-seat quantity, 3-seat minimum), or a one-off scan top-up.
 *  Returns the URL. A Pro/Premium subscriber can buy Teams: the webhook
 *  cancels their old subscription once the Teams one is paid. */
export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(CheckoutSchema)
  .handler(async ({ data, context }) => {
    const { getStripe, isStripeConfigured, stripeEnv } = await import("./stripe.server");
    if (!isStripeConfigured()) {
      throw new Error("Billing isn't configured yet — add the Stripe secrets first.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, plan_expires_at, stripe_customer_id, stripe_subscription_id")
      .eq("id", context.userId)
      .maybeSingle();
    const env = stripeEnv();
    const origin = requestOrigin();
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : undefined;
    const customer = profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : email
        ? { customer_email: email }
        : {};

    if (data.plan === "topup") {
      const price = env.topupPriceIds[data.pack];
      if (!price) throw new Error("Top-ups aren't available yet.");
      const pack = TOPUP_PACKS[data.pack];
      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        line_items: [{ price, quantity: 1 }],
        client_reference_id: context.userId,
        // The webhook adds the credits when payment lands; the size rides along
        // so the webhook never has to guess which pack was bought.
        metadata: {
          ck_topup: data.pack,
          ck_topup_scans: String(pack.scans),
          ck_topup_follow_ups: String(pack.followUps),
        },
        ...customer,
        allow_promotion_codes: true,
        success_url: `${origin}/app/settings?billing=success`,
        cancel_url: `${origin}/app/settings?billing=cancelled`,
      });
      if (!session.url) throw new Error("Stripe did not return a checkout link. Try again.");
      return { url: session.url };
    }

    // Effective plan, so a lapsed dated entitlement doesn't block re-buying.
    const current = effectivePlan(profile?.plan, profile?.plan_expires_at);
    if (data.plan !== "team" && current === "premium")
      throw new Error("You're already on Premium.");
    if (data.plan === "pro" && current === "pro") throw new Error("You're already on Pro.");
    if (profile?.stripe_subscription_id && data.plan !== "team") {
      // One subscription per account: switching tiers goes through the portal.
      throw new Error("You already have a subscription — use Manage billing to change plans.");
    }
    // Moving a subscriber onto Teams replaces their subscription (see webhook).
    const replaceSub =
      data.plan === "team" && profile?.stripe_subscription_id
        ? { ck_replace_sub: profile.stripe_subscription_id }
        : {};

    const price =
      data.plan === "team"
        ? data.interval === "year"
          ? env.teamAnnualPriceId
          : env.teamPriceId
        : data.plan === "premium"
          ? data.interval === "year"
            ? env.premiumAnnualPriceId
            : env.premiumPriceId
          : data.interval === "year"
            ? env.annualPriceId
            : env.priceId;
    if (!price) {
      const name =
        data.plan === "team"
          ? `STRIPE_PRICE_ID_TEAM${data.interval === "year" ? "_ANNUAL" : ""}`
          : data.plan === "premium"
            ? `STRIPE_PRICE_ID_PREMIUM${data.interval === "year" ? "_ANNUAL" : ""}`
            : "STRIPE_PRICE_ID_ANNUAL";
      throw new Error(`That plan isn't configured yet — add ${name} first.`);
    }
    const seats = data.plan === "team" ? Math.max(3, data.seats ?? 3) : 1;

    // Referral discount (referral.ts) on Pro/Premium: the friend's own 20% plus
    // any referrer rewards, as one first-payment coupon. Stripe allows either a
    // coupon or promotion codes on a checkout, not both.
    let discount: { discounts: { coupon: string }[] } | { allow_promotion_codes: true } = {
      allow_promotion_codes: true,
    };
    const refMeta: Record<string, string> = {};
    if (data.plan !== "team") {
      const { referralDiscountFor, ensureReferralCoupon } = await import("./referral.server");
      const ref = await referralDiscountFor(context.userId, true);
      if (ref.pct > 0) {
        discount = { discounts: [{ coupon: await ensureReferralCoupon(getStripe(), ref.pct) }] };
        refMeta["ck_ref_pct"] = String(ref.pct);
        if (ref.friend) refMeta["ck_ref_friend"] = "1";
        if (ref.bonusIds.length) refMeta["ck_ref_bonus"] = ref.bonusIds.join(",");
      }
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: seats }],
      client_reference_id: context.userId,
      // The webhook reads the tier from metadata (session + subscription).
      metadata: { ck_plan: data.plan, ck_seats: String(seats), ...replaceSub, ...refMeta },
      subscription_data: { metadata: { ck_plan: data.plan, ck_seats: String(seats) } },
      ...customer,
      ...discount,
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
