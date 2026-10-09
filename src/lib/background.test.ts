import { describe, expect, it } from "vitest";
import {
  backdropPresets,
  BG_HEIGHT,
  BG_WIDTH,
  CORNERS,
  coverFit,
  panelLayout,
  QR_SIZES,
  shade,
} from "./background";

describe("panelLayout", () => {
  it("keeps the panel inside the 1920x1080 canvas for every corner and size", () => {
    for (const corner of CORNERS) {
      for (const size of QR_SIZES) {
        const { panel, qr } = panelLayout(corner.id, size.id);
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.y).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.w).toBeLessThanOrEqual(BG_WIDTH);
        expect(panel.y + panel.h).toBeLessThanOrEqual(BG_HEIGHT);
        expect(qr.size).toBe(size.px);
      }
    }
  });

  it("anchors to the requested corner", () => {
    expect(panelLayout("tl", "m").panel.x).toBeLessThan(panelLayout("tr", "m").panel.x);
    expect(panelLayout("tl", "m").panel.y).toBeLessThan(panelLayout("bl", "m").panel.y);
  });
});

describe("shade", () => {
  it("lightens, darkens, and clamps", () => {
    expect(shade("#808080", 1)).toBe("#ffffff");
    expect(shade("#808080", -1)).toBe("#000000");
    expect(shade("#E8553D", 0)).toBe("#e8553d");
  });
});

describe("backdropPresets", () => {
  it("derives the first presets from the accent and keeps ids unique", () => {
    const presets = backdropPresets("#E8553D");
    expect(presets.length).toBeGreaterThanOrEqual(5);
    expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
  });
});

describe("coverFit", () => {
  it("crops the longer axis to the 16:9 target", () => {
    const wide = coverFit(4000, 1000);
    expect(wide.sh).toBe(1000);
    expect(wide.sx).toBeGreaterThan(0);
    const tall = coverFit(1000, 4000);
    expect(tall.sw).toBe(1000);
    expect(tall.sy).toBeGreaterThan(0);
  });
});
