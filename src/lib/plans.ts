// Plan definitions and metering math. Pure and client-safe: the server
// enforces these numbers (usage.server.ts, DB card-limit trigger) and the
// settings page renders them.

export type PlanId = "free" | "pro" | "premium";
export type UsageKind = "scan" | "enrich" | "follow_up" | "summarize";

export const USAGE_KINDS: UsageKind[] = ["scan", "enrich", "follow_up", "summarize"];

export const KIND_LABELS: Record<UsageKind, string> = {
  scan: "AI card scans",
  enrich: "Contact enrichments",
  follow_up: "Follow-up drafts",
  summarize: "Note summaries",
};

/** Monthly allowances (reset on the 1st, UTC; no rollover); Infinity = no
 *  cap. Cards is a total, not monthly. */
export const PLAN_LIMITS: Record<PlanId, { cards: number } & Record<UsageKind, number>> = {
  free: { cards: 1, scan: 5, enrich: 5, follow_up: 15, summarize: 15 },
  pro: { cards: 3, scan: 100, enrich: Infinity, follow_up: 100, summarize: Infinity },
  premium: {
    cards: Infinity,
    scan: Infinity,
    enrich: Infinity,
    follow_up: Infinity,
    summarize: Infinity,
  },
};

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
export const PRO_AI_BENEFIT = `${PLAN_LIMITS.pro.scan} AI card scans + ${PLAN_LIMITS.pro.follow_up} follow-up drafts every month — resets monthly.`;

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
  return "You're sending AI requests very quickly — wait a few minutes and try again.";
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

/** Shown (server-side, never silently) when a capped kind runs out. */
export function limitReachedMessage(plan: PlanId, kind: UsageKind, now = new Date()): string {
  const limit = monthlyLimit(plan, kind);
  const used = `You've used your ${plan === "free" ? `${limit} free` : limit} ${KIND_NOUNS[kind]} for this month — your allowance resets on ${formatResetDate(now)}.`;
  if (plan === "free") {
    const pro = monthlyLimit("pro", kind);
    return pro === Infinity
      ? `${used} Need more right now? Upgrade to Pro (${PRO_PRICE_LABEL}).`
      : `${used} Need more right now? Pro includes ${pro} a month (${PRO_PRICE_LABEL}).`;
  }
  return `${used} Need more right now? Premium has no monthly cap.`;
}
