import { describe, expect, it } from "vitest";
import { BG_HEIGHT, BG_MARGIN, BG_WIDTH, CORNERS, coverFit, layoutBadge, QR_SIZES } from "./background-layout";

describe("background badge layout", () => {
  it("keeps the badge inside the 1920×1080 frame with margin for every corner and size", () => {
    for (const c of CORNERS) for (const s of ["S", "M", "L"] as const) {
      const { badge } = layoutBadge(c, s);
      expect(badge.x).toBeGreaterThanOrEqual(BG_MARGIN);
      expect(badge.y).toBeGreaterThanOrEqual(BG_MARGIN);
      expect(badge.x + badge.w).toBeLessThanOrEqual(BG_WIDTH - BG_MARGIN);
      expect(badge.y + badge.h).toBeLessThanOrEqual(BG_HEIGHT - BG_MARGIN);
    }
  });
  it("anchors bottom-right to the bottom-right margin with text facing inward", () => {
    const l = layoutBadge("bottom-right", "M");
    expect(l.badge.x + l.badge.w).toBe(BG_WIDTH - BG_MARGIN);
    expect(l.badge.y + l.badge.h).toBe(BG_HEIGHT - BG_MARGIN);
    expect(l.text.align).toBe("right");
    expect(l.text.x).toBeLessThan(l.qr.x);
  });
  it("uses the size presets for the QR", () => {
    expect(layoutBadge("top-left", "L").qr.w).toBe(QR_SIZES.L);
    expect(QR_SIZES.S).toBeLessThan(QR_SIZES.M);
  });
});

describe("coverFit", () => {
  it("fills the frame and centers a square image", () => {
    const r = coverFit(1000, 1000);
    expect(r.w).toBe(1920);
    expect(r.h).toBe(1920);
    expect(r.y).toBe((1080 - 1920) / 2);
  });
});
