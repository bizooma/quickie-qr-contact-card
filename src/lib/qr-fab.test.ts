import { describe, expect, it } from "vitest";
import { FAB_SIZE, fabArea, isDrag, parseSpot, pixelsToSpot, spotToPixels } from "./qr-fab";

describe("fabArea", () => {
  it("keeps the button on screen and above the tab bar", () => {
    const a = fabArea(390, 844, 72);
    expect(a.minX).toBe(8);
    expect(a.maxX).toBe(390 - 8 - FAB_SIZE);
    expect(a.minY).toBe(8);
    expect(a.maxY).toBe(844 - 72 - 8 - FAB_SIZE);
  });
  it("never inverts on a tiny screen", () => {
    const a = fabArea(40, 40, 72);
    expect(a.maxX).toBeGreaterThanOrEqual(a.minX);
    expect(a.maxY).toBeGreaterThanOrEqual(a.minY);
  });
});

describe("spot <-> pixels", () => {
  const area = fabArea(390, 844, 72);
  it("maps the corners of the free area", () => {
    expect(spotToPixels({ x: 0, y: 0 }, area)).toEqual({ left: 8, top: 8 });
    expect(spotToPixels({ x: 1, y: 1 }, area)).toEqual({ left: area.maxX, top: area.maxY });
  });
  it("round-trips a dropped position", () => {
    const spot = pixelsToSpot(120, 300, area);
    expect(spotToPixels(spot, area)).toEqual({ left: 120, top: 300 });
  });
  it("clamps a drop past the edges", () => {
    expect(pixelsToSpot(-50, 5000, area)).toEqual({ x: 0, y: 1 });
  });
  it("keeps the same relative place after rotating", () => {
    const spot = pixelsToSpot(area.maxX, area.minY, area);
    const landscape = fabArea(844, 390, 72);
    expect(spotToPixels(spot, landscape)).toEqual({ left: landscape.maxX, top: landscape.minY });
  });
});

describe("isDrag", () => {
  it("treats a small wobble as a tap", () => {
    expect(isDrag(3, 4)).toBe(false);
    expect(isDrag(10, 0)).toBe(true);
  });
});

describe("parseSpot", () => {
  it("reads a saved spot and rejects junk", () => {
    expect(parseSpot('{"x":0.25,"y":0.5}')).toEqual({ x: 0.25, y: 0.5 });
    expect(parseSpot('{"x":3,"y":-1}')).toEqual({ x: 1, y: 0 });
    expect(parseSpot(null)).toBeNull();
    expect(parseSpot("nope")).toBeNull();
    expect(parseSpot('{"x":"a","y":1}')).toBeNull();
  });
});
