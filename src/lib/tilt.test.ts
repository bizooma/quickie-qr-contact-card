import { describe, expect, it } from "vitest";
import { easeTilt, tiltFromOrientation, tiltFromPointer, TILT_RANGE_DEG } from "./tilt";

describe("tiltFromOrientation", () => {
  const base = { beta: 40, gamma: 0 };

  it("is still at the resting angle and full at the tilt range", () => {
    expect(tiltFromOrientation(base, base)).toEqual({ x: 0, y: 0 });
    expect(tiltFromOrientation({ beta: 40, gamma: TILT_RANGE_DEG }, base)).toEqual({ x: 1, y: 0 });
    expect(tiltFromOrientation({ beta: 40 - TILT_RANGE_DEG / 2, gamma: 0 }, base)).toEqual({
      x: 0,
      y: -0.5,
    });
  });

  it("never leans further than the range", () => {
    expect(tiltFromOrientation({ beta: 170, gamma: -80 }, base)).toEqual({ x: -1, y: 1 });
  });

  it("follows the screen when the phone is held sideways", () => {
    const leanRight = { beta: 40, gamma: TILT_RANGE_DEG };
    expect(tiltFromOrientation(leanRight, base, 90)).toEqual({ x: 0, y: -1 });
    expect(tiltFromOrientation(leanRight, base, 270)).toEqual({ x: -0, y: 1 });
    expect(tiltFromOrientation(leanRight, base, -90)).toEqual({ x: -0, y: 1 });
  });
});

describe("tiltFromPointer", () => {
  const rect = { left: 100, top: 50, width: 400, height: 800 };
  it("maps the card's corners to the ends of the range", () => {
    expect(tiltFromPointer({ x: 300, y: 450 }, rect)).toEqual({ x: 0, y: 0 });
    expect(tiltFromPointer({ x: 100, y: 50 }, rect)).toEqual({ x: -1, y: -1 });
    expect(tiltFromPointer({ x: 2000, y: 2000 }, rect)).toEqual({ x: 1, y: 1 });
  });
  it("stays still for a card with no size", () => {
    expect(tiltFromPointer({ x: 1, y: 1 }, { ...rect, width: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("easeTilt", () => {
  it("moves part of the way each step", () => {
    expect(easeTilt({ x: 0, y: 0 }, { x: 1, y: -1 }, 0.5)).toEqual({ x: 0.5, y: -0.5 });
  });
});
