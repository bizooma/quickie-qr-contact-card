// Plan definitions and metering math. Pure and client-safe: the server
// enforces these numbers (usage.server.ts, DB card-limit trigger) and the
// settings page renders them.

export type PlanId = "free" | "pro" | "premium";
export type UsageKind = "scan" | "enrich" | "follow_up" | "summarize";

export const USAGE_KINDS: UsageKind[] = ["scan", "enrich", "follow_up", "summarize"];

export const KIND_LABELS: Record<UsageKind, string> = {
  scan: "Card scans",
  enrich: "Contact enrichments",
  follow_up: "Follow-up drafts",
  summarize: "Note summaries",
};

/** Monthly allowances (reset on the 1st, UTC; no rollover); Infinity = no
 *  cap. Cards is a total, not monthly. Free is try-before-you-buy and costs
 *  nothing in AI: its AI comes only from credits people buy (starter pack,
 *  top-ups) or earn (referral bonus). Enrichment (web research on Opus, the
 *  priciest call) is capped on every plan; Premium's scans and drafts carry a
 *  fair-use ceiling far above normal use, so no account can cost more in AI
 *  than it pays. */
export const PLAN_LIMITS: Record<PlanId, { cards: number } & Record<UsageKind, number>> = {
  free: { cards: 1, scan: 0, enrich: 0, follow_up: 0, summarize: 0 },
  pro: { cards: 3, scan: 100, enrich: 100, follow_up: 100, summarize: Infinity },
  premium: {
    cards: Infinity,
    scan: 300,
    enrich: 100,
    follow_up: 300,
    summarize: Infinity,
  },
};

/** Share-backs a free owner collects in total (mirrors shareback_open in
 *  migration 0032); after that the card's "Share yours" form hides. */
export const FREE_SHAREBACK_LIMIT = 5;

/** Free accounts may read their own paper card this many times in total,
 *  to build their digital card; a blurry photo still costs an AI call. */
export const FREE_SELF_SCANS = 3;

/** Paid-only features, named once for upsell copy. */
export const PRO_ONLY_FEATURES =
  "Card scanning, follow-up drafts, contact enrichment, instant lead alerts and the Zapier webhook";

export const PLAN_NAMES: Record<PlanId, string> = { free: "Free", pro: "Pro", premium: "Premium" };

export const PRO_MONTHLY_USD = 8;
export const PRO_ANNUAL_USD = 80;
export const PRO_PRICE_LABEL = `$${PRO_MONTHLY_USD}/mo`;
export const PRO_ANNUAL_PRICE_LABEL = `$${PRO_ANNUAL_USD}/yr`;
export const PREMIUM_MONTHLY_USD = 12;
export const PREMIUM_ANNUAL_USD = 120;
export const PREMIUM_PRICE_LABEL = `$${PREMIUM_MONTHLY_USD}/mo`;
export const PREMIUM_ANNUAL_PRICE_LABEL = `$${PREMIUM_ANNUAL_USD}/yr`;

// Teams: per-seat billing on the org owner; every member gets Premium-level
// features. The 3-seat floor keeps a "team" from undercutting solo Premium.
export const TEAM_SEAT_MONTHLY_USD = 10;
export const TEAM_SEAT_ANNUAL_USD = 100;
export const TEAM_MIN_SEATS = 3;
export const TEAM_SEAT_PRICE_LABEL = `$${TEAM_SEAT_MONTHLY_USD}/user`;
export const TEAM_SEAT_ANNUAL_PRICE_LABEL = `$${TEAM_SEAT_ANNUAL_USD}/user/yr`;

/** And the same derived "2 months free" claim for Teams annual seats. */
export function teamAnnualFreeMonths(): number {
  return Math.floor((12 * TEAM_SEAT_MONTHLY_USD - TEAM_SEAT_ANNUAL_USD) / TEAM_SEAT_MONTHLY_USD);
}

/** Whole months of Pro the annual discount covers — the "2 months free" claim.
 *  Derived from the prices so the marketing line can never drift from reality. */
export function annualFreeMonths(): number {
  return Math.floor((12 * PRO_MONTHLY_USD - PRO_ANNUAL_USD) / PRO_MONTHLY_USD);
}

/** Same claim for Premium: $120/yr vs 12 × $12. */
export function premiumAnnualFreeMonths(): number {
  return Math.floor((12 * PREMIUM_MONTHLY_USD - PREMIUM_ANNUAL_USD) / PREMIUM_MONTHLY_USD);
}

export function normalizePlan(plan: string | null | undefined): PlanId {
  return plan === "pro" || plan === "premium" ? plan : "free";
}

/** A dated plan (Founding Year entitlement) lapses back to free on expiry. */
export function effectivePlan(
  plan: string | null | undefined,
  planExpiresAt: string | null | undefined,
  now = Date.now(),
): PlanId {
  if (planExpiresAt && new Date(planExpiresAt).getTime() <= now) return "free";
  return normalizePlan(plan);
}

export function monthlyLimit(plan: PlanId, kind: UsageKind): number {
  return PLAN_LIMITS[plan][kind];
}

export function isWithinLimit(plan: PlanId, kind: UsageKind, usedThisMonth: number): boolean {
  return usedThisMonth < monthlyLimit(plan, kind);
}

export function remaining(plan: PlanId, kind: UsageKind, usedThisMonth: number): number {
  const limit = monthlyLimit(plan, kind);
  return limit === Infinity ? Infinity : Math.max(0, limit - usedThisMonth);
}

/** One-time starter-pack credits ($7 funnel buyers) only cover these kinds. */
export function creditEligible(kind: UsageKind): kind is "scan" | "follow_up" {
  return kind === "scan" || kind === "follow_up";
}

/** First instant of the current calendar month, UTC — the metering window. */
export function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** First instant of next calendar month, UTC — when the allowance resets. */
export function nextResetDate(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** "Nov 1" — the reset day, in UTC so it never shows as Oct 31 in the US. */
export function formatResetDate(now = new Date()): string {
  return nextResetDate(now).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The exact Pro AI benefit line used everywhere Pro is described. */
/** Starter scan credits a card owner earns when a visitor to their card signs up
 *  (mirrors record_signup_attribution in the database). */
export const REFERRAL_BONUS_SCANS = 5;

/** Premium's AI allowance in one line, for pricing and plan copy. */
export const PREMIUM_AI_BENEFIT = `${PLAN_LIMITS.premium.scan} card scans + ${PLAN_LIMITS.premium.follow_up} follow-up drafts a month — far more than most people use.`;

export const PRO_AI_BENEFIT = `${PLAN_LIMITS.pro.scan} card scans + ${PLAN_LIMITS.pro.follow_up} follow-up drafts every month — resets monthly.`;

/** How scans are counted: per business card read, not per photo or batch. */
export const SCAN_UNIT_NOTE = "1 card = 1 scan";

/** How many units an AI action uses. Scans count each card read (a photo
 *  of three cards is three scans), and a scan that reads nothing still
 *  counts as one, since the AI did the work. Other kinds are one per action. */
export function usageUnits(kind: UsageKind, cardsRead = 1): number {
  return kind === "scan" ? Math.max(1, cardsRead) : 1;
}

/** Sent too many AI requests in a short time (any plan). */
export function rateLimitMessage(): string {
  return "You're sending requests very quickly — wait a few minutes and try again.";
}

// One-off top-up packs, sold in-app through Stripe (STRIPE_PRICE_ID_TOPUP_SMALL /
// _LARGE). Credits never expire, like the starter pack, and are used after the
// monthly allowance. Sized against AI cost: a scan or a draft on Sonnet runs
// about $0.02, so the small pack costs ~$1 to serve and the large one ~$2.40.
export type TopupPack = "small" | "large";
export const TOPUP_PACKS: Record<TopupPack, { usd: number; scans: number; followUps: number }> = {
  small: { usd: 5, scans: 25, followUps: 25 },
  large: { usd: 10, scans: 60, followUps: 60 },
};
export function topupLabel(pack: TopupPack): string {
  const p = TOPUP_PACKS[pack];
  return `${p.scans} scans + ${p.followUps} follow-up drafts for $${p.usd}`;
}

/** A batch needs more scans than are left (but some are). */
export function scansLeftMessage(available: number, now = new Date()): string {
  return `You have ${available} scan${available === 1 ? "" : "s"} left this month (${SCAN_UNIT_NOTE}) — remove some photos and try again. Your allowance resets on ${formatResetDate(now)}.`;
}

/** Short plural noun for allowance lines: "37 of 100 scans left". */
export const KIND_NOUNS: Record<UsageKind, string> = {
  scan: "scans",
  enrich: "enrichments",
  follow_up: "follow-up drafts",
  summarize: "summaries",
};

/** "37 of 100 scans left this month · resets Nov 1" (capped kinds only). */
export function allowanceLine(
  kind: UsageKind,
  used: number,
  limit: number,
  now = new Date(),
): string {
  const left = Math.max(0, limit - used);
  return `${left} of ${limit} ${KIND_NOUNS[kind]} left this month · resets ${formatResetDate(now)}`;
}

/** "Card scans" etc., for "… come with Pro" lines. */
const AI_FEATURE_NAMES: Record<UsageKind, string> = {
  scan: "Card scans",
  enrich: "Contact enrichments",
  follow_up: "Follow-up drafts",
  summarize: "Note summaries",
};

/** Shown (server-side, never silently) when a capped kind runs out, or when
 *  the plan has none of it (free). */
export function limitReachedMessage(plan: PlanId, kind: UsageKind, now = new Date()): string {
  const limit = monthlyLimit(plan, kind);
  if (limit === 0) {
    const pro = monthlyLimit("pro", kind);
    const extra =
      kind === "scan"
        ? " Scanning QR codes and digital contact cards stays free."
        : creditEligible(kind)
          ? " Or add a top-up pack."
          : "";
    return `${AI_FEATURE_NAMES[kind]} come with Pro — ${pro === Infinity ? "" : `${pro} a month, `}${PRO_PRICE_LABEL}.${extra}`;
  }
  const used = `You've used your ${plan === "free" ? `${limit} free` : limit} ${KIND_NOUNS[kind]} for this month — your allowance resets on ${formatResetDate(now)}.`;
  if (plan === "free") {
    const pro = monthlyLimit("pro", kind);
    return pro === Infinity
      ? `${used} Need more right now? Upgrade to Pro (${PRO_PRICE_LABEL}).`
      : `${used} Need more right now? Pro includes ${pro} a month (${PRO_PRICE_LABEL}).`;
  }
  const premium = monthlyLimit("premium", kind);
  if (plan === "pro" && premium > monthlyLimit("pro", kind)) {
    return `${used} Need more right now? Premium includes ${premium} a month (${PREMIUM_PRICE_LABEL}).`;
  }
  return creditEligible(kind)
    ? `${used} Need more right now? Add a top-up pack in Settings.`
    : used;
}

/** Owner-side line about the free share-back allowance. */
export function sharebackAllowanceLine(used: number): string {
  const left = Math.max(0, FREE_SHAREBACK_LIMIT - used);
  return left > 0
    ? `${left} of ${FREE_SHAREBACK_LIMIT} free share-backs left — unlimited on Pro.`
    : `You've collected your ${FREE_SHAREBACK_LIMIT} free share-backs, so the "Share yours" form is hidden on your card. Upgrade to turn it back on.`;
}
