// Pure layout math for the 1920×1080 meeting background (client-safe, no canvas).

export const BG_WIDTH = 1920;
export const BG_HEIGHT = 1080;
export const BG_MARGIN = 64;
export const BADGE_PAD = 28;
export const BADGE_GAP = 28;
export const BADGE_TEXT_WIDTH = 380;

export const QR_SIZES = { S: 180, M: 260, L: 340 } as const;
export type QrSize = keyof typeof QR_SIZES;

export const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type Corner = (typeof CORNERS)[number];

export type Rect = { x: number; y: number; w: number; h: number };
export type BadgeLayout = { badge: Rect; qr: Rect; text: { x: number; nameY: number; labelY: number; align: "left" | "right"; maxWidth: number } };

/** Badge sits in the chosen corner; text always faces the center of the frame. */
export function layoutBadge(corner: Corner, size: QrSize): BadgeLayout {
  const q = QR_SIZES[size];
  const w = BADGE_PAD * 2 + q + BADGE_GAP + BADGE_TEXT_WIDTH;
  const h = BADGE_PAD * 2 + q;
  const right = corner.endsWith("right");
  const bottom = corner.startsWith("bottom");
  const x = right ? BG_WIDTH - BG_MARGIN - w : BG_MARGIN;
  const y = bottom ? BG_HEIGHT - BG_MARGIN - h : BG_MARGIN;
  const qrX = right ? x + w - BADGE_PAD - q : x + BADGE_PAD;
  const textEdge = right ? qrX - BADGE_GAP : qrX + q + BADGE_GAP;
  const mid = y + h / 2;
  return {
    badge: { x, y, w, h },
    qr: { x: qrX, y: y + BADGE_PAD, w: q, h: q },
    text: { x: textEdge, nameY: mid - 8, labelY: mid + 40, align: right ? "right" : "left", maxWidth: BADGE_TEXT_WIDTH },
  };
}

/** Cover-fit source image into the target, cropping overflow (centered). */
export function coverFit(srcW: number, srcH: number, dstW = BG_WIDTH, dstH = BG_HEIGHT): Rect {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}
