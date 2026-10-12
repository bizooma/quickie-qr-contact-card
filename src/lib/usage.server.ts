// Server-only metering: reads the caller's plan, counts this month's usage,
// and records completed AI actions. Uses the service role throughout so a
// client can neither fake nor erase its own usage (authenticated users have
// SELECT only on ai_usage). Top-level import is safe only from other
// server-only modules.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  creditEligible,
  effectivePlan,
  isWithinLimit,
  limitReachedMessage,
  monthlyLimit,
  monthStartIso,
  type PlanId,
  type UsageKind,
} from "./plans";

export async function getPlan(userId: string): Promise<PlanId> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  const own = effectivePlan(data?.plan, data?.plan_expires_at);
  if (own === "premium") return own;
  // Members of a funded team get Premium-level features (Teams tier).
  const { data: covered } = await supabaseAdmin.rpc("has_team_seat", { _user: userId });
  return covered ? "premium" : own;
}

export async function countUsageThisMonth(userId: string, kind: UsageKind): Promise<number> {
  const { count } = await supabaseAdmin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", monthStartIso());
  return count ?? 0;
}

/** Remaining one-time starter-pack credits ($7 funnel buyers). */
export async function getStarterCredits(
  userId: string,
): Promise<{ scan: number; follow_up: number }> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("credit_scan, credit_follow_up")
    .eq("id", userId)
    .maybeSingle();
  return { scan: data?.credit_scan ?? 0, follow_up: data?.credit_follow_up ?? 0 };
}

/** Throws a user-facing error when the caller's plan is out of allowance. */
export async function assertWithinLimit(userId: string, kind: UsageKind): Promise<void> {
  const plan = await getPlan(userId);
  if (plan !== "free") return; // Pro and Premium are unlimited — skip the count query.
  const used = await countUsageThisMonth(userId, kind);
  if (isWithinLimit(plan, kind, used)) return;
  // Past the monthly allowance: a starter-pack credit still covers it.
  if (creditEligible(kind)) {
    const credits = await getStarterCredits(userId);
    if (credits[kind] > 0) return;
  }
  throw new Error(limitReachedMessage(kind));
}

/** Best-effort: a metering hiccup must never fail a successful AI action. */
export async function recordUsage(userId: string, kind: UsageKind): Promise<void> {
  try {
    await supabaseAdmin.from("ai_usage").insert({ user_id: userId, kind });
    // If this action ran past the free monthly allowance, it was covered by a
    // one-time starter credit — consume one (atomically, in SQL).
    if (!creditEligible(kind)) return;
    const plan = await getPlan(userId);
    if (plan !== "free") return;
    const used = await countUsageThisMonth(userId, kind); // includes the row just inserted
    if (used <= monthlyLimit("free", kind)) return;
    await supabaseAdmin.rpc("consume_starter_credit", { _user: userId, _kind: kind });
  } catch {
    // Swallowed on purpose.
  }
}

// ---- Own-card scans --------------------------------------------------------
// Scanning your own business card is free on every plan, so it doesn't touch
// the monthly scan allowance; a rolling daily cap keeps it from being used as
// an unmetered scanner for other people's cards.

export async function assertSelfScanAllowance(userId: string, perDay: number): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "self_scan")
    .gte("created_at", since);
  if ((count ?? 0) >= perDay) {
    throw new Error(
      "You've scanned your own card a lot today — try again tomorrow, or edit the details by hand.",
    );
  }
}

/** Best-effort, like recordUsage. */
export async function recordSelfScan(userId: string): Promise<void> {
  try {
    await supabaseAdmin.from("ai_usage").insert({ user_id: userId, kind: "self_scan" });
  } catch {
    // Swallowed on purpose.
  }
}
