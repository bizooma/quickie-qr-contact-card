import { describe, expect, it } from "vitest";
import { headshotCropRect } from "./headshot";

describe("headshotCropRect", () => {
  it("returns null without a box or with a degenerate image", () => {
    expect(headshotCropRect(1000, 800, null)).toBeNull();
    expect(headshotCropRect(1000, 800, undefined)).toBeNull();
    expect(headshotCropRect(0, 800, { x: 0.1, y: 0.1, w: 0.2, h: 0.2 })).toBeNull();
    expect(headshotCropRect(1000, 0, { x: 0.1, y: 0.1, w: 0.2, h: 0.2 })).toBeNull();
  });

  it("converts a normalized box to a padded pixel rect", () => {
    const rect = headshotCropRect(1000, 800, { x: 0.5, y: 0.25, w: 0.2, h: 0.25 }, 0.1);
    // 10% padding: x 0.48–0.72, y 0.225–0.525
    expect(rect).toEqual({ x: 480, y: 180, w: 240, h: 240 });
  });

  it("clamps padding at the image edges", () => {
    const rect = headshotCropRect(1000, 800, { x: 0, y: 0, w: 0.2, h: 0.2 }, 0.5);
    expect(rect).toEqual({ x: 0, y: 0, w: 300, h: 240 });
  });

  it("never extends past the right/bottom edge after rounding", () => {
    const rect = headshotCropRect(999, 777, { x: 0.8, y: 0.8, w: 0.2, h: 0.2 });
    expect(rect).not.toBeNull();
    expect(rect!.x + rect!.w).toBeLessThanOrEqual(999);
    expect(rect!.y + rect!.h).toBeLessThanOrEqual(777);
  });

  it("rejects specks and zero-size boxes", () => {
    expect(headshotCropRect(1000, 800, { x: 0.5, y: 0.5, w: 0.01, h: 0.01 })).toBeNull();
    expect(headshotCropRect(1000, 800, { x: 0.5, y: 0.5, w: 0, h: 0.2 })).toBeNull();
  });

  it("rejects a box that covers nearly the whole card photo", () => {
    expect(headshotCropRect(1000, 800, { x: 0.02, y: 0.02, w: 0.95, h: 0.95 })).toBeNull();
  });

  it("keeps a tall or wide box that is large in only one dimension", () => {
    expect(headshotCropRect(1000, 800, { x: 0.05, y: 0.05, w: 0.25, h: 0.9 })).not.toBeNull();
  });
});
