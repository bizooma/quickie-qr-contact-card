// Server-only metering: reads the caller's plan, counts this month's usage,
// and records completed AI actions. Uses the service role throughout so a
// client can neither fake nor erase its own usage (authenticated users have
// SELECT only on ai_usage). Top-level import is safe only from other
// server-only modules.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  isWithinLimit,
  limitReachedMessage,
  monthStartIso,
  normalizePlan,
  type PlanId,
  type UsageKind,
} from "./plans";

export async function getPlan(userId: string): Promise<PlanId> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  // A dated plan (Founding Year entitlement) lapses back to free on expiry.
  if (data?.plan_expires_at && new Date(data.plan_expires_at).getTime() <= Date.now()) {
    return "free";
  }
  return normalizePlan(data?.plan);
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

/** Throws a user-facing error when the caller's plan is out of allowance. */
export async function assertWithinLimit(userId: string, kind: UsageKind): Promise<void> {
  const plan = await getPlan(userId);
  if (plan === "pro") return; // Unlimited — skip the count query.
  const used = await countUsageThisMonth(userId, kind);
  if (!isWithinLimit(plan, kind, used)) {
    throw new Error(limitReachedMessage(kind));
  }
}

/** Best-effort: a metering hiccup must never fail a successful AI action. */
export async function recordUsage(userId: string, kind: UsageKind): Promise<void> {
  try {
    await supabaseAdmin.from("ai_usage").insert({ user_id: userId, kind });
  } catch {
    // Swallowed on purpose.
  }
}
