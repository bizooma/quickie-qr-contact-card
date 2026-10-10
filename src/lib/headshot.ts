// Pure math for cropping a headshot out of a scanned card photo. The AI returns a
// normalized box; this turns it into a safe pixel rect (canvas work stays in image-prep).

import type { HeadshotBox } from "./ai-model";

export type PixelRect = { x: number; y: number; w: number; h: number };

// Model boxes are approximate — pad them so a slightly-tight box doesn't clip the face.
export const HEADSHOT_PADDING = 0.15;
// Reject boxes that are clearly not a headshot: specks (sub-2% of the image) and
// near-whole-card boxes (the model boxed the card, not the face on it).
const MIN_FRACTION = 0.02;
const MAX_FRACTION = 0.85;

export function headshotCropRect(
  imageWidth: number,
  imageHeight: number,
  box: HeadshotBox | null | undefined,
  padding = HEADSHOT_PADDING,
): PixelRect | null {
  if (!box || imageWidth <= 0 || imageHeight <= 0) return null;
  if (box.w <= 0 || box.h <= 0) return null;
  if (box.w < MIN_FRACTION || box.h < MIN_FRACTION) return null;
  if (box.w > MAX_FRACTION && box.h > MAX_FRACTION) return null;

  const padX = box.w * padding;
  const padY = box.h * padding;
  const left = Math.max(0, box.x - padX);
  const top = Math.max(0, box.y - padY);
  const right = Math.min(1, box.x + box.w + padX);
  const bottom = Math.min(1, box.y + box.h + padY);
  if (right <= left || bottom <= top) return null;

  const rect = {
    x: Math.round(left * imageWidth),
    y: Math.round(top * imageHeight),
    w: Math.max(1, Math.round((right - left) * imageWidth)),
    h: Math.max(1, Math.round((bottom - top) * imageHeight)),
  };
  // Rounding can push the rect past the image edge; pull it back in.
  rect.w = Math.min(rect.w, imageWidth - rect.x);
  rect.h = Math.min(rect.h, imageHeight - rect.y);
  return rect.w >= 1 && rect.h >= 1 ? rect : null;
}
