import { describe, expect, it } from "vitest";
import { HEADLINES, pickVariant, variantMeta } from "./ab";

describe("pickVariant", () => {
  it("keeps a stored assignment regardless of the draw", () => {
    expect(pickVariant("a", 0.99)).toBe("a");
    expect(pickVariant("c", 0.01)).toBe("c");
  });
  it("splits fresh visitors 50/50 on the draw", () => {
    expect(pickVariant(null, 0.0)).toBe("a");
    expect(pickVariant(null, 0.49)).toBe("a");
    expect(pickVariant(null, 0.5)).toBe("c");
    expect(pickVariant(null, 0.99)).toBe("c");
  });
  it("ignores garbage stored values", () => {
    expect(pickVariant("b", 0.9)).toBe("c");
    expect(pickVariant("", 0.1)).toBe("a");
  });
});

describe("variantMeta", () => {
  it("tags the location with the variant", () => {
    expect(variantMeta("hero", "a")).toBe("hero|v=a");
    expect(variantMeta("final", "c")).toBe("final|v=c");
  });
  it("falls back to the bare location when unassigned", () => {
    expect(variantMeta("hero", null)).toBe("hero");
  });
});

describe("HEADLINES", () => {
  it("defines both variants with copy", () => {
    for (const v of ["a", "c"] as const) {
      expect(HEADLINES[v].lines.join("")).not.toBe("");
      expect(HEADLINES[v].sub.length).toBeGreaterThan(20);
    }
  });
});
