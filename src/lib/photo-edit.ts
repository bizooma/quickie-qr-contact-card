// Pure geometry for the photo editor (enlarge, drag, rotate inside a square
// frame). Canvas drawing stays in the component; this is what the tests cover.

export type PhotoEdit = {
  /** 1 = the image just covers the frame; larger enlarges it. */
  zoom: number;
  /** Degrees, any value (quarter turns plus straightening). */
  rotation: number;
  /** Pan of the image centre from the frame centre, in frame pixels. */
  dx: number;
  dy: number;
};

export const DEFAULT_EDIT: PhotoEdit = { zoom: 1, rotation: 0, dx: 0, dy: 0 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const MAX_TILT = 30;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Scale at which a w×h image rotated by `rotation` degrees exactly covers a
 *  square frame of side `frame` (no gaps in the corners). */
export function coverScale(w: number, h: number, rotation: number, frame: number): number {
  if (w <= 0 || h <= 0 || frame <= 0) return 1;
  const c = Math.abs(Math.cos(rad(rotation)));
  const s = Math.abs(Math.sin(rad(rotation)));
  // The frame's corners, rotated back into image space, reach (frame/2)(|cos|+|sin|)
  // along each axis; the image half-sizes must at least reach that far.
  return (frame * (c + s)) / Math.min(w, h);
}

/** Keeps the pan inside the range where the image still covers the frame. */
export function clampPan(
  w: number,
  h: number,
  edit: PhotoEdit,
  frame: number,
): { dx: number; dy: number } {
  const scale = coverScale(w, h, edit.rotation, frame) * Math.max(MIN_ZOOM, edit.zoom);
  const c = Math.cos(rad(edit.rotation));
  const s = Math.sin(rad(edit.rotation));
  const reach = (frame / 2) * (Math.abs(c) + Math.abs(s));
  // Slack along the image's own axes, then rotate the pan into that space.
  const limitX = Math.max(0, (scale * w) / 2 - reach);
  const limitY = Math.max(0, (scale * h) / 2 - reach);
  const px = c * edit.dx + s * edit.dy;
  const py = -s * edit.dx + c * edit.dy;
  const cx = Math.max(-limitX, Math.min(limitX, px));
  const cy = Math.max(-limitY, Math.min(limitY, py));
  return { dx: c * cx - s * cy, dy: s * cx + c * cy };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(zoom) ? zoom : MIN_ZOOM));
}

/** Rotation split into whole quarter turns and the straightening remainder. */
export function splitRotation(rotation: number): { quarters: number; tilt: number } {
  const quarters = Math.round(rotation / 90) || 0; // `|| 0` turns -0 into 0
  return { quarters, tilt: rotation - quarters * 90 };
}

/** The canvas transform that draws the image for this edit: translate to
 *  (tx, ty), rotate by `rotation`, scale by `scale`, then draw the image
 *  centred on the origin. `output` is the side of the target square. */
export function drawTransform(
  w: number,
  h: number,
  edit: PhotoEdit,
  frame: number,
  output: number,
): { tx: number; ty: number; scale: number; rotation: number } {
  const k = output / frame;
  const { dx, dy } = clampPan(w, h, edit, frame);
  return {
    tx: output / 2 + dx * k,
    ty: output / 2 + dy * k,
    scale: coverScale(w, h, edit.rotation, frame) * clampZoom(edit.zoom) * k,
    rotation: edit.rotation,
  };
}
