import { describe, expect, it } from "vitest";
import {
  backdropPresets,
  BG_HEIGHT,
  BG_WIDTH,
  captionColors,
  clampPosition,
  CORNERS,
  coverFit,
  defaultDesign,
  gradientLine,
  layerBox,
  moveLayer,
  newImageLayer,
  newTextLayer,
  panelLayout,
  pdfSafeText,
  QR_SIZES,
  resizeLayer,
  shade,
  snapPosition,
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

describe("gradientLine", () => {
  it("follows CSS angles across the whole canvas", () => {
    const right = gradientLine(90);
    expect(right.x0).toBeCloseTo(0);
    expect(right.x1).toBeCloseTo(BG_WIDTH);
    expect(right.y0).toBeCloseTo(BG_HEIGHT / 2);
    expect(right.y1).toBeCloseTo(BG_HEIGHT / 2);
    const down = gradientLine(180);
    expect(down.y0).toBeCloseTo(0);
    expect(down.y1).toBeCloseTo(BG_HEIGHT);
    expect(down.x0).toBeCloseTo(BG_WIDTH / 2);
  });
});

describe("design layers", () => {
  it("starts with the QR panel bottom-right, fully on canvas", () => {
    const d = defaultDesign("#E8553D");
    expect(d.layers).toHaveLength(1);
    const box = layerBox(d.layers[0]!);
    expect(box.x + box.w).toBeLessThanOrEqual(BG_WIDTH);
    expect(box.y + box.h).toBeLessThanOrEqual(BG_HEIGHT);
    expect(box.x).toBeGreaterThan(BG_WIDTH / 2);
    expect(box.y).toBeGreaterThan(BG_HEIGHT / 2);
  });

  it("places a logo top-left within 320x160 and a photo as a top-right circle", () => {
    const logo = newImageLayer("logo", "Logo", 4);
    const lb = layerBox(logo);
    expect(lb.w).toBeLessThanOrEqual(320);
    expect(lb.h).toBeLessThanOrEqual(160);
    expect(lb.x).toBeLessThan(BG_WIDTH / 2);
    const photo = newImageLayer("photo", "Photo", 0.75);
    const pb = layerBox(photo);
    expect(pb.w).toBe(pb.h);
    expect(pb.x).toBeGreaterThan(BG_WIDTH / 2);
    expect(newImageLayer("upload", "Pic", Number.NaN).aspect).toBe(1);
  });

  it("clamps and snaps boxes onto the canvas", () => {
    expect(clampPosition({ x: -50, y: 2000, w: 100, h: 100 })).toEqual({
      x: 0,
      y: BG_HEIGHT - 100,
    });
    expect(snapPosition("center", 200, 100)).toEqual({ x: 860, y: 490 });
    expect(snapPosition("br", 200, 100)).toEqual({ x: BG_WIDTH - 248, y: BG_HEIGHT - 148 });
  });

  it("resizes around the center and respects limits", () => {
    const t = newTextLayer("Hello", "#fff");
    const box = { x: 500, y: 500, w: 200, h: 80 };
    const big = resizeLayer(t, 128, box);
    expect(big.size).toBe(128);
    expect(big.x).toBe(400);
    expect(big.y).toBe(460);
    expect(resizeLayer(t, 5, box).size).toBe(20);
    const qr = defaultDesign("#000000").layers[0]!;
    const huge = resizeLayer(qr, 9999, layerBox(qr));
    const hb = layerBox(huge);
    expect(hb.x + hb.w).toBeLessThanOrEqual(BG_WIDTH);
    expect(hb.y + hb.h).toBeLessThanOrEqual(BG_HEIGHT);
  });

  it("reorders the stack and ignores moves past the ends", () => {
    const a = newTextLayer("a", "#fff");
    const b = newTextLayer("b", "#fff");
    expect(moveLayer([a, b], a.id, 1).map((l) => l.id)).toEqual([b.id, a.id]);
    expect(moveLayer([a, b], b.id, 1)).toEqual([a, b]);
  });
});

describe("pdfSafeText", () => {
  it("accepts Latin-1 text and rejects scripts Helvetica can't encode", () => {
    expect(pdfSafeText("Café — “Jack” Reacher\nCEO")).toBe(true);
    expect(pdfSafeText("田中 太郎")).toBe(false);
    expect(pdfSafeText("Hi 👋")).toBe(false);
  });
});

describe("captionColors", () => {
  it("uses dark text on light panels and light text on dark ones", () => {
    expect(captionColors("#FFFFFF").name).toBe("#111827");
    expect(captionColors("#111111").name).toBe("#ffffff");
  });
});
