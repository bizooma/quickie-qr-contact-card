// Pure helpers for placing a center image on a QR code. The QR is generated at
// error-correction level H when an image is shown, so covering ~6% of the area
// stays well within what scanners tolerate.

import type { PlanId } from "./plans";

/** Side length of the square viewBox in a `qrcode`-generated SVG (0 0 N N). */
export function qrViewBoxSize(svg: string): number | null {
  const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && w === h ? w : null;
}

export type LogoBox = { x: number; y: number; size: number; pad: number };

/** Centered box for the logo plus its white backing pad, in viewBox units. */
export function logoBox(viewSize: number, fraction = 0.22): LogoBox {
  const size = viewSize * fraction;
  const pad = size * 0.14;
  return { x: (viewSize - size) / 2, y: (viewSize - size) / 2, size, pad };
}

/** "rounded": a logo fitted inside a rounded white square.
 *  "circle": a photo cropped to fill a circle with a white ring. */
export type CenterShape = "rounded" | "circle";

/** Returns the QR SVG with a white-backed center image appended. */
export function svgWithLogo(svg: string, href: string, shape: CenterShape = "rounded"): string {
  const view = qrViewBoxSize(svg);
  if (!view) return svg;
  const b = logoBox(view);
  let overlay: string;
  if (shape === "circle") {
    const cx = view / 2;
    const r = b.size / 2;
    overlay =
      `<defs><clipPath id="ck-qr-center"><circle cx="${cx}" cy="${cx}" r="${r}"/></clipPath></defs>` +
      `<circle cx="${cx}" cy="${cx}" r="${r + b.pad}" fill="#FFFFFF"/>` +
      `<image x="${b.x}" y="${b.y}" width="${b.size}" height="${b.size}" href="${href}" preserveAspectRatio="xMidYMid slice" clip-path="url(#ck-qr-center)"/>`;
  } else {
    const r = (b.size + b.pad * 2) * 0.18;
    overlay =
      `<rect x="${b.x - b.pad}" y="${b.y - b.pad}" width="${b.size + b.pad * 2}" height="${b.size + b.pad * 2}" rx="${r}" fill="#FFFFFF"/>` +
      `<image x="${b.x}" y="${b.y}" width="${b.size}" height="${b.size}" href="${href}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return svg.replace("</svg>", `${overlay}</svg>`);
}

export type QrCenterChoice = "photo" | "logo";

/** The center image is a Pro/Premium perk (team members resolve to Premium). */
export function qrCenterAllowed(plan: PlanId | undefined): boolean {
  return plan === "pro" || plan === "premium";
}

/** Normalizes the stored column value; anything unknown means "none". */
export function parseQrCenter(value: string | null | undefined): QrCenterChoice | null {
  return value === "photo" || value === "logo" ? value : null;
}

/** Small, palette-optimized ContactKickstart badge (~10 KB) used as the
 *  default QR center. */
export const BRAND_QR_CENTER = "/brand/qr-center.png";

export type QrCenterSource =
  | { kind: "stored"; path: string; shape: CenterShape }
  | { kind: "brand"; url: string; shape: CenterShape };

/** What goes in the middle of the QR. The owner's photo or logo when the plan
 *  includes it and that image exists; otherwise the ContactKickstart badge —
 *  so every QR carries an image and a downgrade never leaves a broken one. */
export function qrCenterSource(
  choice: QrCenterChoice | null,
  paths: { headshotPath: string | null | undefined; logoPath: string | null | undefined },
  plan: PlanId | undefined,
): QrCenterSource {
  if (choice && qrCenterAllowed(plan)) {
    if (choice === "photo" && paths.headshotPath)
      return { kind: "stored", path: paths.headshotPath, shape: "circle" };
    if (choice === "logo" && paths.logoPath)
      return { kind: "stored", path: paths.logoPath, shape: "rounded" };
  }
  return { kind: "brand", url: BRAND_QR_CENTER, shape: "rounded" };
}
