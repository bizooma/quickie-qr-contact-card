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
  TOPUP_PACKS,
  topupLabel,
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
  OFFICE_ANNUAL_PRICE_LABEL,
  OFFICE_MONTHLY_USD,
  OFFICE_PRICE_LABEL,
  OFFICE_SEATS,
  TEAM_MIN_SEATS,
  officeAnnualFreeMonths,
  officeSeats,
  PRO_ANNUAL_PRICE_LABEL,
  PRO_PRICE_LABEL,
  remaining,
  FREE_SHAREBACK_LIMIT,
  sharebackAllowanceLine,
  premiumPriceFor,
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
  it("free has no AI, Pro gets 100 scans + 100 drafts, Premium a 300 fair-use ceiling", () => {
    for (const kind of ["scan", "enrich", "follow_up", "summarize"] as const) {
      expect(monthlyLimit("free", kind)).toBe(0);
      expect(isWithinLimit("free", kind, 0)).toBe(false);
    }
    expect(monthlyLimit("pro", "scan")).toBe(100);
    expect(monthlyLimit("pro", "follow_up")).toBe(100);
    expect(monthlyLimit("premium", "scan")).toBe(300);
    expect(monthlyLimit("premium", "follow_up")).toBe(300);
    expect(monthlyLimit("premium", "summarize")).toBe(Infinity);
    expect(isWithinLimit("pro", "scan", 99)).toBe(true);
    expect(isWithinLimit("pro", "scan", 100)).toBe(false);
    expect(isWithinLimit("pro", "follow_up", 100)).toBe(false);
    expect(isWithinLimit("premium", "scan", 299)).toBe(true);
    expect(isWithinLimit("premium", "scan", 300)).toBe(false);
  });
  it("caps enrichment at 100 a month on Pro and Premium", () => {
    expect(monthlyLimit("pro", "enrich")).toBe(100);
    expect(monthlyLimit("premium", "enrich")).toBe(100);
    expect(isWithinLimit("premium", "enrich", 100)).toBe(false);
  });
  it("cards: 1 free, 3 pro, unlimited premium", () => {
    expect(PLAN_LIMITS.free.cards).toBe(1);
    expect(PLAN_LIMITS.pro.cards).toBe(3);
    expect(PLAN_LIMITS.premium.cards).toBe(Infinity);
  });
  it("remaining clamps at zero and stays Infinity for unlimited kinds", () => {
    expect(remaining("pro", "scan", 40)).toBe(60);
    expect(remaining("free", "enrich", 0)).toBe(0);
    expect(remaining("pro", "enrich", 99)).toBe(1);
    expect(remaining("pro", "summarize", 99)).toBe(Infinity);
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
      "You've used your 100 scans for this month — your allowance resets on Nov 1. Need more right now? Premium includes 300 a month ($12/mo).",
    );
    expect(limitReachedMessage("pro", "follow_up", oct)).toContain(
      "You've used your 100 follow-up drafts for this month",
    );
  });
  it("tells free accounts each AI feature comes with Pro", () => {
    expect(limitReachedMessage("free", "scan", oct)).toBe(
      "Card scans come with Pro — 100 a month, $8/mo. Scanning QR codes and digital contact cards stays free.",
    );
    expect(limitReachedMessage("free", "follow_up", oct)).toBe(
      "Follow-up drafts come with Pro — 100 a month, $8/mo. Or add a top-up pack.",
    );
    expect(limitReachedMessage("free", "enrich", oct)).toBe(
      "Contact enrichments come with Pro — 100 a month, $8/mo.",
    );
    expect(limitReachedMessage("free", "summarize", oct)).toBe(
      "Note summaries come with Pro — $8/mo.",
    );
  });
});

describe("free share-backs", () => {
  it("counts down to the 5-contact cap, then says the form is hidden", () => {
    expect(FREE_SHAREBACK_LIMIT).toBe(5);
    expect(sharebackAllowanceLine(2)).toBe("3 of 5 free share-backs left — unlimited on Pro.");
    expect(sharebackAllowanceLine(5)).toContain("form is hidden on your card");
    expect(sharebackAllowanceLine(9)).toContain("form is hidden on your card");
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
      "100 card scans + 100 follow-up drafts every month — resets monthly.",
    );
    expect(PRO_AI_BENEFIT.toLowerCase()).not.toContain("unlimited");
  });
});

describe("annual pricing", () => {
  it("the '2 months free' claims match the actual prices", () => {
    expect(annualFreeMonths()).toBe(2);
    expect(premiumAnnualFreeMonths()).toBe(2);
    expect(officeAnnualFreeMonths()).toBe(2);
  });
  it("Office never undercuts solo Premium, and is a funded team", () => {
    expect(OFFICE_MONTHLY_USD).toBeGreaterThan(PREMIUM_MONTHLY_USD * 3);
    expect(OFFICE_SEATS).toBeGreaterThanOrEqual(TEAM_MIN_SEATS);
  });
  it("labels derive from the numeric prices", () => {
    expect(PRO_PRICE_LABEL).toBe("$8/mo");
    expect(PRO_ANNUAL_PRICE_LABEL).toBe("$80/yr");
    expect(PREMIUM_PRICE_LABEL).toBe("$12/mo");
    expect(PREMIUM_ANNUAL_PRICE_LABEL).toBe("$120/yr");
    expect(OFFICE_PRICE_LABEL).toBe("$39/mo");
    expect(OFFICE_ANNUAL_PRICE_LABEL).toBe("$390/yr");
  });
});

describe("officeSeats", () => {
  it("grants the standard seats unless a custom deal sets more", () => {
    expect(officeSeats(undefined)).toBe(OFFICE_SEATS);
    expect(officeSeats("")).toBe(OFFICE_SEATS);
    expect(officeSeats("3")).toBe(OFFICE_SEATS);
    expect(officeSeats("junk")).toBe(OFFICE_SEATS);
    expect(officeSeats("12")).toBe(12);
    expect(officeSeats("12.7")).toBe(12);
    expect(officeSeats("100000")).toBe(500);
  });
});

describe("rate limit and top-up", () => {
  it("has a plain rate-limit message", () => {
    expect(rateLimitMessage()).toContain("wait a few minutes");
  });
  it("describes the top-up packs from their numbers", () => {
    expect(topupLabel("small")).toBe("25 scans + 25 follow-up drafts for $5");
    expect(topupLabel("large")).toBe("60 scans + 60 follow-up drafts for $10");
    expect(TOPUP_PACKS.large.scans).toBeGreaterThan(TOPUP_PACKS.small.scans);
  });
  it("points Premium at top-ups, and says only the reset date for enrichment", () => {
    const oct = new Date("2026-10-19T12:00:00Z");
    expect(limitReachedMessage("premium", "scan", oct)).toBe(
      "You've used your 300 scans for this month — your allowance resets on Nov 1. Need more right now? Add a top-up pack in Settings.",
    );
    expect(limitReachedMessage("premium", "enrich", oct)).toBe(
      "You've used your 100 enrichments for this month — your allowance resets on Nov 1.",
    );
    expect(limitReachedMessage("pro", "enrich", oct)).toBe(
      "You've used your 100 enrichments for this month — your allowance resets on Nov 1.",
    );
  });
});

describe("premiumPriceFor", () => {
  const prices = { pro: "p_m", proAnnual: "p_y", premium: "pr_m", premiumAnnual: "pr_y" };
  it("keeps the billing interval when moving Pro to Premium", () => {
    expect(premiumPriceFor("p_m", prices)).toBe("pr_m");
    expect(premiumPriceFor("p_y", prices)).toBe("pr_y");
  });
  it("refuses unknown prices and unset Premium prices", () => {
    expect(premiumPriceFor("team", prices)).toBeNull();
    expect(premiumPriceFor(null, prices)).toBeNull();
    expect(premiumPriceFor("p_y", { ...prices, premiumAnnual: "" })).toBeNull();
  });
});
