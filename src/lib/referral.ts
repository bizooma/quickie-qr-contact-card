// Referral discount rules. Pure: Stripe and the database live in
// referral.server.ts and the webhook.
//
// - A friend who signed up from your link gets 20% off their first Pro or
//   Premium payment (the first year on an annual plan).
// - When they pay, you get 20% off your next payment, then 10% off every
//   payment after that for as long as they keep paying.
// - Each paying friend adds their share; the total is capped at 100%.
// Teams subscriptions are not discounted (a per-seat bill would multiply it).

export const FRIEND_FIRST_PCT = 20;
export const REFERRER_FIRST_PCT = 20;
export const REFERRER_ONGOING_PCT = 10;
export const MAX_REFERRAL_PCT = 100;

export type ReferralDiscountInput = {
  /** This person was referred and hasn't used their own 20% yet. */
  friend: boolean;
  /** Friends of theirs paying right now. */
  paying: number;
  /** How many of those still owe the one-time first-payment bonus. */
  pending: number;
};

/** The percent off one payment, and how many one-time bonuses it uses up
 *  (only the ones that fit under the cap, so none is wasted). */
export function computeReferralDiscount({ friend, paying, pending }: ReferralDiscountInput): {
  pct: number;
  bonusesUsed: number;
} {
  const own = friend ? FRIEND_FIRST_PCT : 0;
  const base = Math.min(MAX_REFERRAL_PCT, own + REFERRER_ONGOING_PCT * Math.max(0, paying));
  const extra = REFERRER_FIRST_PCT - REFERRER_ONGOING_PCT;
  const room = Math.floor((MAX_REFERRAL_PCT - base) / extra);
  const bonusesUsed = Math.max(0, Math.min(Math.min(pending, paying), room));
  return { pct: base + extra * bonusesUsed, bonusesUsed };
}

/** One Stripe coupon per percentage, applied to a single payment. */
export function referralCouponId(pct: number): string {
  return `ck_ref_${pct}`;
}

/** The link a person shares: the landing page remembers it, and the signup
 *  that follows is recorded as their referral (record_signup_attribution). */
export function referralLink(origin: string, cardSlug: string): string {
  return `${origin}/?ref=invite&c=${encodeURIComponent(cardSlug)}`;
}
