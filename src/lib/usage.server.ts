// Server-only metering: reads the caller's plan, reserves usage before an
// AI call and settles it after (migration 0026). Uses the service role throughout so a
// client can neither fake nor erase its own usage (authenticated users have
// SELECT only on ai_usage). Top-level import is safe only from other
// server-only modules.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  effectivePlan,
  formatResetDate,
  FREE_SELF_SCANS,
  KIND_LABELS,
  limitReachedMessage,
  monthlyLimit,
  monthStartIso,
  rateLimitMessage,
  scansLeftMessage,
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

export type Reservation = {
  id: string;
  kind: UsageKind;
  limit: number;
  usedBefore: number;
  units: number;
};

/** Reserves `units` of usage BEFORE the AI call, atomically in SQL: the
 *  plan's monthly allowance first, then never-expiring starter credits.
 *  Throws a user-facing error when out of allowance or sending too fast.
 *  Always settle the reservation afterwards (settleUsage). */
export async function reserveUsage(
  userId: string,
  kind: UsageKind,
  units = 1,
): Promise<Reservation> {
  const plan = await getPlan(userId);
  const limit = monthlyLimit(plan, kind);
  const { data, error } = await supabaseAdmin.rpc("reserve_ai_usage", {
    _user: userId,
    _kind: kind,
    _units: units,
    _limit: limit === Infinity ? (null as unknown as number) : limit,
  });
  if (error) throw new Error("Could not check your allowance. Try again in a moment.");
  const r = (data ?? {}) as {
    ok?: boolean;
    code?: string;
    available?: number;
    reservation?: string;
    used_before?: number;
  };
  if (r.ok && r.reservation) {
    return { id: r.reservation, kind, limit, usedBefore: r.used_before ?? 0, units };
  }
  if (r.code === "rate") throw new Error(rateLimitMessage());
  if (r.code === "cap") {
    const available = r.available ?? 0;
    if (available === 0) throw new Error(limitReachedMessage(plan, kind));
    throw new Error(scansLeftMessage(available));
  }
  throw new Error("Could not check your allowance. Try again in a moment.");
}

/** After the AI call: keep `actual` units (0 when the call failed, which
 *  releases the reservation and refunds any starter credits). Best-effort:
 *  a metering hiccup must never fail a successful AI action. */
export async function settleUsage(reservation: Reservation, actual: number): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc("settle_ai_usage", {
      _reservation: reservation.id,
      _actual: actual,
    });
    if (error) console.error(`settle_ai_usage failed: ${error.message}`);
    if (actual > 0) await warnNearCap(reservation, actual);
  } catch (e) {
    console.error(`settleUsage failed: ${(e as Error).message}`);
  }
}

/** One push when this action crosses 80% or 100% of a capped allowance. */
async function warnNearCap(r: Reservation, actual: number): Promise<void> {
  if (r.limit === Infinity) return;
  const after = r.usedBefore + actual;
  const crossed = (t: number) => r.usedBefore < t && after >= t;
  const label = KIND_LABELS[r.kind].toLowerCase();
  let message: { title: string; body: string } | null = null;
  if (crossed(r.limit)) {
    message = {
      title: `You've used this month's ${label}`,
      body: `Your allowance resets on ${formatResetDate()}. Need more now? Upgrade in Settings.`,
    };
  } else if (crossed(Math.ceil(r.limit * 0.8))) {
    message = {
      title: `${Math.max(0, r.limit - after)} ${label} left this month`,
      body: `You're at 80% of your allowance. It resets on ${formatResetDate()}.`,
    };
  }
  if (!message) return;
  const { sendPushToUser } = await import("./notify.server");
  await sendPushToUser(r.id && r.kind ? ((await ownerOf(r.id)) ?? "") : "", {
    ...message,
    url: "/app/settings",
  });
}

async function ownerOf(reservation: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("ai_usage")
    .select("user_id")
    .eq("reservation", reservation)
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}

// ---- Own-card scans --------------------------------------------------------
// Scanning your own business card doesn't touch the monthly scan allowance; a
// rolling daily cap keeps it from being used as an unmetered scanner for other
// people's cards, and free accounts get FREE_SELF_SCANS in total.

export async function assertSelfScanAllowance(userId: string, perDay: number): Promise<void> {
  if ((await getPlan(userId)) === "free") {
    const { count: total } = await supabaseAdmin
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "self_scan");
    if ((total ?? 0) >= FREE_SELF_SCANS) {
      throw new Error(
        `You've used your ${FREE_SELF_SCANS} free card reads — type your details in instead, or upgrade to Pro for card scanning.`,
      );
    }
  }
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

/** Recorded BEFORE the AI call, so photos that turn out not to be a card
 *  still count toward the daily cap. Best-effort. */
export async function recordSelfScan(userId: string): Promise<void> {
  try {
    await supabaseAdmin.from("ai_usage").insert({ user_id: userId, kind: "self_scan" });
  } catch {
    // Swallowed on purpose.
  }
}

type CallUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

/** Per-call token log (ai_calls): the basis for pricing packs and plans from
 *  real numbers. Best-effort — never fails the AI call. */
export async function logAiCall(
  userId: string,
  kind: string,
  model: string,
  usage: CallUsage | null | undefined,
): Promise<void> {
  if (!usage) return;
  try {
    const { error } = await supabaseAdmin.from("ai_calls").insert({
      user_id: userId,
      kind,
      model,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      web_searches: usage.server_tool_use?.web_search_requests ?? 0,
    });
    if (error) console.error(`ai_calls insert failed: ${error.message}`);
  } catch (e) {
    console.error(`logAiCall failed: ${(e as Error).message}`);
  }
}
