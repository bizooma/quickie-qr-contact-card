// Parallax for the Liquid Glass backdrop: how far the lights lean, from the
// phone's tilt or, on a computer, the pointer. Pure maths here; the hook in
// src/hooks/use-tilt.ts wires it to the browser. Every result is in -1..1 on
// each axis, and the CSS turns that into a few pixels per light.

export type Tilt = { x: number; y: number };

/** Degrees of tilt away from the resting angle that move the lights fully. */
export const TILT_RANGE_DEG = 20;

/** How quickly the resting angle follows a new way of holding the phone, so
 *  the lights recentre instead of staying pushed to one side. */
export const BASELINE_FOLLOW = 0.02;

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}

/** The phone's tilt relative to its resting angle (gamma: left/right, beta:
 *  front/back), turned to match the screen when it is held sideways. */
export function tiltFromOrientation(
  reading: { beta: number; gamma: number },
  base: { beta: number; gamma: number },
  screenAngle = 0,
): Tilt {
  const dx = clamp((reading.gamma - base.gamma) / TILT_RANGE_DEG);
  const dy = clamp((reading.beta - base.beta) / TILT_RANGE_DEG);
  switch (((screenAngle % 360) + 360) % 360) {
    case 90:
      return { x: dy, y: -dx };
    case 180:
      return { x: -dx, y: -dy };
    case 270:
      return { x: -dy, y: dx };
    default:
      return { x: dx, y: dy };
  }
}

/** The pointer's position relative to the card's centre, in -1..1. */
export function tiltFromPointer(
  point: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
): Tilt {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp(((point.x - rect.left) / rect.width) * 2 - 1),
    y: clamp(((point.y - rect.top) / rect.height) * 2 - 1),
  };
}

/** One step of easing from `from` towards `to`, so the lights glide. */
export function easeTilt(from: Tilt, to: Tilt, amount = 0.12): Tilt {
  return { x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
}
