import { describe, expect, it } from "vitest";
import { computeReferralDiscount, referralCouponId, referralLink } from "./referral";

describe("computeReferralDiscount", () => {
  it("gives nothing without a referral", () => {
    expect(computeReferralDiscount({ friend: false, paying: 0, pending: 0 })).toEqual({
      pct: 0,
      bonusesUsed: 0,
    });
  });

  it("gives a referred friend 20% off their first payment", () => {
    expect(computeReferralDiscount({ friend: true, paying: 0, pending: 0 }).pct).toBe(20);
  });

  it("gives the referrer 20% on the first payment after a friend pays, then 10%", () => {
    expect(computeReferralDiscount({ friend: false, paying: 1, pending: 1 })).toEqual({
      pct: 20,
      bonusesUsed: 1,
    });
    expect(computeReferralDiscount({ friend: false, paying: 1, pending: 0 })).toEqual({
      pct: 10,
      bonusesUsed: 0,
    });
  });

  it("stacks 10% per paying friend", () => {
    expect(computeReferralDiscount({ friend: false, paying: 4, pending: 0 }).pct).toBe(40);
    expect(computeReferralDiscount({ friend: false, paying: 4, pending: 1 }).pct).toBe(50);
  });

  it("caps at 100% and only uses the bonuses that fit", () => {
    expect(computeReferralDiscount({ friend: false, paying: 10, pending: 0 }).pct).toBe(100);
    expect(computeReferralDiscount({ friend: false, paying: 12, pending: 3 })).toEqual({
      pct: 100,
      bonusesUsed: 0,
    });
    // 8 paying = 80%, room for two +10 bonuses of the three owed.
    expect(computeReferralDiscount({ friend: false, paying: 8, pending: 3 })).toEqual({
      pct: 100,
      bonusesUsed: 2,
    });
  });

  it("adds a referred friend's own 20% to their referrer rewards", () => {
    expect(computeReferralDiscount({ friend: true, paying: 2, pending: 2 })).toEqual({
      pct: 60,
      bonusesUsed: 2,
    });
  });

  it("never counts more bonuses than paying friends", () => {
    expect(computeReferralDiscount({ friend: false, paying: 1, pending: 5 })).toEqual({
      pct: 20,
      bonusesUsed: 1,
    });
  });
});

describe("referral helpers", () => {
  it("names one coupon per percentage", () => {
    expect(referralCouponId(30)).toBe("ck_ref_30");
  });

  it("builds a link the landing page records as a referral", () => {
    expect(referralLink("https://quickieqr.com", "tamzyn")).toBe(
      "https://quickieqr.com/?ref=invite&c=tamzyn",
    );
  });
});
