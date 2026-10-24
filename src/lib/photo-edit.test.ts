import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDIT,
  clampPan,
  clampZoom,
  coverScale,
  drawTransform,
  splitRotation,
} from "./photo-edit";

describe("coverScale", () => {
  it("scales the shorter side to the frame when upright", () => {
    expect(coverScale(400, 200, 0, 100)).toBeCloseTo(0.5);
    expect(coverScale(200, 400, 0, 100)).toBeCloseTo(0.5);
  });
  it("is the same after a quarter turn", () => {
    expect(coverScale(400, 200, 90, 100)).toBeCloseTo(0.5);
  });
  it("grows by √2 at 45° so the corners stay covered", () => {
    expect(coverScale(300, 300, 45, 100)).toBeCloseTo(Math.SQRT2 / 3);
  });
});

describe("clampPan", () => {
  it("allows no pan along a side that exactly covers the frame", () => {
    const p = clampPan(400, 200, { ...DEFAULT_EDIT, dx: 30, dy: 30 }, 100);
    expect(p.dy).toBeCloseTo(0); // height is the tight side
    expect(p.dx).toBeCloseTo(30); // width has 150px of slack each way
  });
  it("allows panning once enlarged and clamps symmetrically", () => {
    const edit = { ...DEFAULT_EDIT, zoom: 2 };
    const limit = clampPan(200, 200, { ...edit, dx: 999, dy: -999 }, 100);
    expect(limit.dx).toBeCloseTo(50);
    expect(limit.dy).toBeCloseTo(-50);
    expect(clampPan(200, 200, { ...edit, dx: 20, dy: 10 }, 100)).toEqual({ dx: 20, dy: 10 });
  });
  it("keeps the frame covered when rotated", () => {
    const edit = { zoom: 1, rotation: 90, dx: 0, dy: 40 };
    // A 400×200 image on its side has slack vertically, none horizontally.
    const p = clampPan(400, 200, edit, 100);
    expect(p.dy).toBeCloseTo(40);
    expect(Math.abs(p.dx)).toBeLessThan(1e-9);
    expect(Math.abs(clampPan(400, 200, { ...edit, dx: 40, dy: 0 }, 100).dx)).toBeLessThan(1e-9);
  });
});

describe("zoom and rotation helpers", () => {
  it("clamps zoom into range and ignores garbage", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(9)).toBe(4);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
  it("splits rotation into quarter turns and tilt", () => {
    expect(splitRotation(95)).toEqual({ quarters: 1, tilt: 5 });
    expect(splitRotation(-10)).toEqual({ quarters: 0, tilt: -10 });
    expect(splitRotation(270)).toEqual({ quarters: 3, tilt: 0 });
  });
});

describe("drawTransform", () => {
  it("scales the preview transform to the output size", () => {
    const t = drawTransform(400, 200, { zoom: 2, rotation: 0, dx: 10, dy: 0 }, 100, 500);
    expect(t.tx).toBeCloseTo(250 + 50);
    expect(t.ty).toBeCloseTo(250);
    expect(t.scale).toBeCloseTo(0.5 * 2 * 5);
  });
});
