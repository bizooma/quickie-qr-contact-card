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
  return effectivePlan(data?.plan, data?.plan_expires_at);
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
