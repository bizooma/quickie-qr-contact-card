// Plan definitions and metering math. Pure and client-safe: the server
// enforces these numbers (usage.server.ts, DB card-limit trigger) and the
// settings page renders them.

export type PlanId = "free" | "pro";
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
  pro: { cards: 50, scan: Infinity, enrich: Infinity, follow_up: Infinity, summarize: Infinity },
};

export const PRO_PRICE_LABEL = "$8/mo";

export function normalizePlan(plan: string | null | undefined): PlanId {
  return plan === "pro" ? "pro" : "free";
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

/** First instant of the current calendar month, UTC — the metering window. */
export function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function limitReachedMessage(kind: UsageKind): string {
  return `You've used this month's free ${KIND_LABELS[kind].toLowerCase()} — upgrade to Pro (${PRO_PRICE_LABEL}) for unlimited AI.`;
}
