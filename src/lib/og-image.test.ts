import { describe, expect, it } from "vitest";
import { ellipsize, ogLayout, ogSubtitle, OG_HEIGHT, OG_WIDTH } from "./og-image";

describe("ogLayout", () => {
  it("keeps every element inside the canvas", () => {
    const L = ogLayout();
    expect(L.avatar.cx - L.avatar.r).toBeGreaterThan(0);
    expect(L.avatar.cy + L.avatar.r).toBeLessThan(OG_HEIGHT);
    expect(L.name.x + L.name.maxWidth).toBeLessThanOrEqual(OG_WIDTH);
    expect(L.footer.y).toBeLessThan(OG_HEIGHT);
  });
});

describe("ellipsize", () => {
  const measure = (s: string) => s.length * 10; // 10px per char
  it("returns short text unchanged", () => {
    expect(ellipsize("short", 100, measure)).toBe("short");
  });
  it("truncates long text with an ellipsis that fits", () => {
    const out = ellipsize("a very long name indeed", 100, measure);
    expect(out.endsWith("…")).toBe(true);
    expect(measure(out)).toBeLessThanOrEqual(100);
  });
  it("never trims to nothing", () => {
    expect(ellipsize("abc", 5, measure).length).toBeGreaterThan(0);
  });
});

describe("ogSubtitle", () => {
  it("joins title and company", () => {
    expect(ogSubtitle({ job_title: "CEO", company: "Acme" })).toBe("CEO · Acme");
    expect(ogSubtitle({ job_title: null, company: "Acme" })).toBe("Acme");
    expect(ogSubtitle({ job_title: null, company: null })).toBe("");
  });
});
