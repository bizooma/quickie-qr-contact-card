import { describe, expect, it } from "vitest";
import {
  isWithinLimit,
  limitReachedMessage,
  monthStartIso,
  monthlyLimit,
  normalizePlan,
  remaining,
} from "./plans";

describe("normalizePlan", () => {
  it("maps anything that isn't 'pro' to free", () => {
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("free")).toBe("free");
    expect(normalizePlan(null)).toBe("free");
    expect(normalizePlan("enterprise")).toBe("free");
  });
});

describe("limits", () => {
  it("free is capped, pro is unlimited", () => {
    expect(monthlyLimit("free", "scan")).toBe(10);
    expect(monthlyLimit("pro", "scan")).toBe(Infinity);
    expect(isWithinLimit("free", "scan", 9)).toBe(true);
    expect(isWithinLimit("free", "scan", 10)).toBe(false);
    expect(isWithinLimit("pro", "scan", 1_000_000)).toBe(true);
  });
  it("remaining clamps at zero and stays Infinity for pro", () => {
    expect(remaining("free", "enrich", 2)).toBe(3);
    expect(remaining("free", "enrich", 99)).toBe(0);
    expect(remaining("pro", "enrich", 99)).toBe(Infinity);
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
