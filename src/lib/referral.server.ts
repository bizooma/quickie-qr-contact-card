// Server-only side of the referral discount (rules in referral.ts). Top-level
// import is safe only from other server-only modules; *.functions.ts files
// import it inside handlers.

import type Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeReferralDiscount, referralCouponId } from "./referral";

type PayingReferral = { id: string; bonus_pending: boolean };

async function payingReferrals(ownerId: string): Promise<PayingReferral[]> {
  const { data, error } = await supabaseAdmin.rpc("referral_reward_state", { _owner: ownerId });
  if (error) throw new Error(`referral state: ${error.message}`);
  return (data ?? []) as unknown as PayingReferral[];
}

async function friendDiscountEligible(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("referrals")
    .select("id")
    .eq("referred_user_id", userId)
    .is("friend_discount_used_at", null)
    .maybeSingle();
  if (error) throw new Error(`referral lookup: ${error.message}`);
  return !!data;
}

/** The discount this person's next payment earns: their own first-payment
 *  20% when `includeFriend` and unused, plus their referrer rewards. */
export async function referralDiscountFor(
  userId: string,
  includeFriend: boolean,
): Promise<{ pct: number; friend: boolean; bonusIds: string[] }> {
  const [friend, paying] = await Promise.all([
    includeFriend ? friendDiscountEligible(userId) : Promise.resolve(false),
    payingReferrals(userId),
  ]);
  const pendingIds = paying.filter((p) => p.bonus_pending).map((p) => p.id);
  const { pct, bonusesUsed } = computeReferralDiscount({
    friend,
    paying: paying.length,
    pending: pendingIds.length,
  });
  return { pct, friend, bonusIds: pendingIds.slice(0, bonusesUsed) };
}

/** A one-payment percent-off coupon, created the first time it's needed. */
export async function ensureReferralCoupon(stripe: Stripe, pct: number): Promise<string> {
  const id = referralCouponId(pct);
  try {
    await stripe.coupons.retrieve(id);
  } catch (e) {
    if ((e as { code?: string }).code !== "resource_missing") throw e;
    await stripe.coupons.create({
      id,
      percent_off: pct,
      duration: "once",
      name: `Referral discount ${pct}%`,
    });
  }
  return id;
}

export async function markBonusesApplied(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabaseAdmin
    .from("referrals")
    .update({ bonus_applied_at: new Date().toISOString() })
    .in("id", ids)
    .is("bonus_applied_at", null);
  if (error) throw new Error(`referral bonus: ${error.message}`);
}

/** A referred friend's first paid subscription: starts the referrer's rewards,
 *  and records whether the friend's own 20% was used on it. */
export async function markFriendPaid(userId: string, usedFriendDiscount: boolean): Promise<void> {
  const now = new Date().toISOString();
  const first = await supabaseAdmin
    .from("referrals")
    .update({ first_paid_at: now })
    .eq("referred_user_id", userId)
    .is("first_paid_at", null);
  if (first.error) throw new Error(`referral paid: ${first.error.message}`);
  if (usedFriendDiscount) {
    const used = await supabaseAdmin
      .from("referrals")
      .update({ friend_discount_used_at: now })
      .eq("referred_user_id", userId)
      .is("friend_discount_used_at", null);
    if (used.error) throw new Error(`referral discount used: ${used.error.message}`);
  }
}
