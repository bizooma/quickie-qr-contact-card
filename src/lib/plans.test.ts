import { describe, expect, it } from "vitest";
import {
  annualFreeMonths,
  creditEligible,
  effectivePlan,
  isWithinLimit,
  limitReachedMessage,
  monthStartIso,
  monthlyLimit,
  normalizePlan,
  PLAN_LIMITS,
  PREMIUM_ANNUAL_PRICE_LABEL,
  PREMIUM_PRICE_LABEL,
  premiumAnnualFreeMonths,
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
  it("free is capped, paid tiers are unlimited on AI", () => {
    expect(monthlyLimit("free", "scan")).toBe(5);
    expect(monthlyLimit("pro", "scan")).toBe(Infinity);
    expect(monthlyLimit("premium", "scan")).toBe(Infinity);
    expect(isWithinLimit("free", "scan", 4)).toBe(true);
    expect(isWithinLimit("free", "scan", 5)).toBe(false);
    expect(isWithinLimit("pro", "scan", 1_000_000)).toBe(true);
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

describe("limitReachedMessage", () => {
  it("names the exhausted feature and the upgrade", () => {
    const msg = limitReachedMessage("scan");
    expect(msg).toContain("ai card scans");
    expect(msg).toContain("Pro");
  });
});

describe("annual pricing", () => {
  it("the '2 months free' claims match the actual prices", () => {
    expect(annualFreeMonths()).toBe(2);
    expect(premiumAnnualFreeMonths()).toBe(2);
  });
  it("labels derive from the numeric prices", () => {
    expect(PRO_PRICE_LABEL).toBe("$8/mo");
    expect(PRO_ANNUAL_PRICE_LABEL).toBe("$80/yr");
    expect(PREMIUM_PRICE_LABEL).toBe("$12/mo");
    expect(PREMIUM_ANNUAL_PRICE_LABEL).toBe("$120/yr");
  });
});
