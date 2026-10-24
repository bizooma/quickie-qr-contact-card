import { describe, expect, it } from "vitest";
import {
  allowanceLine,
  annualFreeMonths,
  creditEligible,
  formatResetDate,
  nextResetDate,
  PRO_AI_BENEFIT,
  rateLimitMessage,
  scansLeftMessage,
  TOPUP_FOLLOW_UPS,
  TOPUP_LABEL,
  TOPUP_SCANS,
  TOPUP_USD,
  usageUnits,
  effectivePlan,
  isWithinLimit,
  limitReachedMessage,
  monthStartIso,
  monthlyLimit,
  normalizePlan,
  PLAN_LIMITS,
  PREMIUM_ANNUAL_PRICE_LABEL,
  PREMIUM_MONTHLY_USD,
  PREMIUM_PRICE_LABEL,
  premiumAnnualFreeMonths,
  TEAM_MIN_SEATS,
  TEAM_SEAT_ANNUAL_PRICE_LABEL,
  TEAM_SEAT_MONTHLY_USD,
  TEAM_SEAT_PRICE_LABEL,
  teamAnnualFreeMonths,
  PRO_ANNUAL_PRICE_LABEL,
  PRO_PRICE_LABEL,
  remaining,
} from "./plans";

describe("normalizePlan", () => {
  it("maps anything that isn't a paid tier to free", () => {
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("premium")).toBe("premium");
    expect(normalizePlan("free")).toBe("free");
    expect(normalizePlan(null)).toBe("free");
    expect(normalizePlan("enterprise")).toBe("free");
  });
});

describe("effectivePlan", () => {
  const now = new Date("2026-10-11T00:00:00Z").getTime();
  it("lapses a dated plan back to free on expiry", () => {
    expect(effectivePlan("pro", "2026-10-10T00:00:00Z", now)).toBe("free");
    expect(effectivePlan("pro", "2027-10-10T00:00:00Z", now)).toBe("pro");
    expect(effectivePlan("pro", null, now)).toBe("pro");
    expect(effectivePlan("premium", null, now)).toBe("premium");
  });
});

describe("limits", () => {
  it("free is capped, Pro gets 100 scans + 100 drafts a month, Premium has no cap", () => {
    expect(monthlyLimit("free", "scan")).toBe(5);
    expect(monthlyLimit("pro", "scan")).toBe(100);
    expect(monthlyLimit("pro", "follow_up")).toBe(100);
    expect(monthlyLimit("premium", "scan")).toBe(Infinity);
    expect(monthlyLimit("premium", "follow_up")).toBe(Infinity);
    expect(isWithinLimit("free", "scan", 4)).toBe(true);
    expect(isWithinLimit("free", "scan", 5)).toBe(false);
    expect(isWithinLimit("pro", "scan", 99)).toBe(true);
    expect(isWithinLimit("pro", "scan", 100)).toBe(false);
    expect(isWithinLimit("pro", "follow_up", 100)).toBe(false);
    expect(isWithinLimit("premium", "scan", 1_000_000)).toBe(true);
  });
  it("cards: 1 free, 3 pro, unlimited premium", () => {
    expect(PLAN_LIMITS.free.cards).toBe(1);
    expect(PLAN_LIMITS.pro.cards).toBe(3);
    expect(PLAN_LIMITS.premium.cards).toBe(Infinity);
  });
  it("remaining clamps at zero and stays Infinity for pro", () => {
    expect(remaining("free", "enrich", 2)).toBe(3);
    expect(remaining("free", "enrich", 99)).toBe(0);
    expect(remaining("pro", "enrich", 99)).toBe(Infinity);
  });
  it("starter credits only cover scans and follow-ups", () => {
    expect(creditEligible("scan")).toBe(true);
    expect(creditEligible("follow_up")).toBe(true);
    expect(creditEligible("enrich")).toBe(false);
    expect(creditEligible("summarize")).toBe(false);
  });
});

describe("monthStartIso", () => {
  it("returns the first UTC instant of the month", () => {
    expect(monthStartIso(new Date("2026-10-10T14:00:00Z"))).toBe("2026-10-01T00:00:00.000Z");
    expect(monthStartIso(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("monthly reset", () => {
  it("resets on the 1st of next month, UTC", () => {
    expect(nextResetDate(new Date("2026-10-19T12:00:00Z")).toISOString()).toBe(
      "2026-11-01T00:00:00.000Z",
    );
    expect(nextResetDate(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
    expect(formatResetDate(new Date("2026-10-19T12:00:00Z"))).toBe("Nov 1");
    expect(formatResetDate(new Date("2026-12-31T23:59:59Z"))).toBe("Jan 1");
  });
  it("shows what's left this month", () => {
    const oct = new Date("2026-10-19T12:00:00Z");
    expect(allowanceLine("scan", 63, 100, oct)).toBe(
      "37 of 100 scans left this month · resets Nov 1",
    );
    expect(allowanceLine("follow_up", 120, 100, oct)).toBe(
      "0 of 100 follow-up drafts left this month · resets Nov 1",
    );
  });
});

describe("limitReachedMessage", () => {
  const oct = new Date("2026-10-19T12:00:00Z");
  it("tells Pro when the allowance resets and points at Premium", () => {
    expect(limitReachedMessage("pro", "scan", oct)).toBe(
      "You've used your 100 scans for this month — your allowance resets on Nov 1. Need more right now? Premium has no monthly cap.",
    );
    expect(limitReachedMessage("pro", "follow_up", oct)).toContain(
      "You've used your 100 follow-up drafts for this month",
    );
  });
  it("points free accounts at Pro", () => {
    const msg = limitReachedMessage("free", "scan", oct);
    expect(msg).toContain("You've used your 5 free scans for this month");
    expect(msg).toContain("resets on Nov 1");
    expect(msg).toContain("Pro includes 100 a month");
  });
});

describe("1 card = 1 scan", () => {
  it("counts scans per card read, at least one per scan", () => {
    expect(usageUnits("scan", 3)).toBe(3);
    expect(usageUnits("scan", 1)).toBe(1);
    expect(usageUnits("scan", 0)).toBe(1);
    expect(usageUnits("follow_up")).toBe(1);
    expect(usageUnits("enrich", 5)).toBe(1);
  });
  it("explains a batch that needs more scans than are left", () => {
    const oct = new Date("2026-10-19T12:00:00Z");
    expect(scansLeftMessage(3, oct)).toBe(
      "You have 3 scans left this month (1 card = 1 scan) — remove some photos and try again. Your allowance resets on Nov 1.",
    );
    expect(scansLeftMessage(1, oct)).toContain("You have 1 scan left");
  });
});

describe("Pro copy", () => {
  it("states the monthly allowance, never 'unlimited'", () => {
    expect(PRO_AI_BENEFIT).toBe(
      "100 AI card scans + 100 follow-up drafts every month — resets monthly.",
    );
    expect(PRO_AI_BENEFIT.toLowerCase()).not.toContain("unlimited");
  });
});

describe("annual pricing", () => {
  it("the '2 months free' claims match the actual prices", () => {
    expect(annualFreeMonths()).toBe(2);
    expect(premiumAnnualFreeMonths()).toBe(2);
    expect(teamAnnualFreeMonths()).toBe(2);
  });
  it("the smallest team never undercuts solo Premium", () => {
    expect(TEAM_MIN_SEATS * TEAM_SEAT_MONTHLY_USD).toBeGreaterThan(PREMIUM_MONTHLY_USD);
  });
  it("labels derive from the numeric prices", () => {
    expect(PRO_PRICE_LABEL).toBe("$8/mo");
    expect(PRO_ANNUAL_PRICE_LABEL).toBe("$80/yr");
    expect(PREMIUM_PRICE_LABEL).toBe("$12/mo");
    expect(PREMIUM_ANNUAL_PRICE_LABEL).toBe("$120/yr");
    expect(TEAM_SEAT_PRICE_LABEL).toBe("$10/user");
    expect(TEAM_SEAT_ANNUAL_PRICE_LABEL).toBe("$100/user/yr");
  });
});

describe("rate limit and top-up", () => {
  it("has a plain rate-limit message", () => {
    expect(rateLimitMessage()).toContain("wait a few minutes");
  });
  it("describes the top-up pack from its numbers", () => {
    expect(TOPUP_LABEL).toBe(
      `${TOPUP_SCANS} scans + ${TOPUP_FOLLOW_UPS} follow-up drafts for $${TOPUP_USD}`,
    );
    expect(TOPUP_SCANS).toBe(50);
  });
  it("points Pro at Premium's uncapped plan", () => {
    expect(limitReachedMessage("pro", "scan", new Date("2026-10-19T12:00:00Z"))).toContain(
      "Premium has no monthly cap",
    );
  });
});
