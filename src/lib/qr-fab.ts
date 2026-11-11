// The floating "Show my QR code" button in the app, which the owner can drag
// anywhere on screen. Its spot is kept as fractions of the free area (0..1 on
// each axis) so it lands in the same place after rotating or resizing. Pure
// maths here; src/components/QrFab.tsx wires it to the pointer.

export const FAB_KEY = "ck-qr-fab";
export const FAB_SIZE = 56;
/** How far a finger moves before a press counts as a drag, not a tap. */
export const DRAG_SLOP = 8;
const EDGE = 8;

export type FabSpot = { x: number; y: number };
export type FabArea = { minX: number; maxX: number; minY: number; maxY: number };

/** Where the button may sit: inside the screen, clear of the bottom tab bar
 *  (`bottomReserve` px tall). */
export function fabArea(width: number, height: number, bottomReserve: number): FabArea {
  const maxX = Math.max(EDGE, width - EDGE - FAB_SIZE);
  const maxY = Math.max(EDGE, height - bottomReserve - EDGE - FAB_SIZE);
  return { minX: EDGE, maxX, minY: EDGE, maxY };
}

function clamp01(v: number) {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

/** The button's top-left corner, in px, for a saved spot. */
export function spotToPixels(spot: FabSpot, area: FabArea): { left: number; top: number } {
  return {
    left: Math.round(area.minX + clamp01(spot.x) * (area.maxX - area.minX)),
    top: Math.round(area.minY + clamp01(spot.y) * (area.maxY - area.minY)),
  };
}

/** The spot to save for a top-left corner in px (clamped onto the screen). */
export function pixelsToSpot(left: number, top: number, area: FabArea): FabSpot {
  const w = area.maxX - area.minX;
  const h = area.maxY - area.minY;
  return {
    x: w > 0 ? clamp01((left - area.minX) / w) : 0,
    y: h > 0 ? clamp01((top - area.minY) / h) : 0,
  };
}

export function isDrag(dx: number, dy: number, slop = DRAG_SLOP): boolean {
  return Math.hypot(dx, dy) > slop;
}

/** A saved spot, or null when there is none or it is unreadable. */
export function parseSpot(raw: string | null): FabSpot | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<FabSpot>;
    if (typeof v.x !== "number" || typeof v.y !== "number") return null;
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
    return { x: clamp01(v.x), y: clamp01(v.y) };
  } catch {
    return null;
  }
}
