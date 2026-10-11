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

/** Monthly allowances; Infinity = unlimited. Cards is a total, not monthly. */
export const PLAN_LIMITS: Record<PlanId, { cards: number } & Record<UsageKind, number>> = {
  free: { cards: 1, scan: 10, enrich: 5, follow_up: 15, summarize: 15 },
  pro: { cards: 3, scan: Infinity, enrich: Infinity, follow_up: Infinity, summarize: Infinity },
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
export const PREMIUM_PRICE_LABEL = `$${PREMIUM_MONTHLY_USD}/mo`;

/** Whole months of Pro the annual discount covers — the "2 months free" claim.
 *  Derived from the prices so the marketing line can never drift from reality. */
export function annualFreeMonths(): number {
  return Math.floor((12 * PRO_MONTHLY_USD - PRO_ANNUAL_USD) / PRO_MONTHLY_USD);
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

export function limitReachedMessage(kind: UsageKind): string {
  return `You've used this month's free ${KIND_LABELS[kind].toLowerCase()} — upgrade to Pro (${PRO_PRICE_LABEL}) for unlimited AI.`;
}
