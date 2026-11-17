// Browser-only: draws a card's logo and photo as the PNGs a Wallet pass
// needs. Done here because the browser can decode any upload (JPEG, WebP,
// SVG); the server can't. Any image that fails to load is simply left off.

import {
  contrastRatio,
  hexToRgb,
  luminance,
  PASS_IMAGE_SIZES,
  type PassImageName,
} from "./apple-pass";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}

function toBase64Png(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}

type LogoLook = { chip: string | null; rounded: boolean };

/** How the logo should sit on the pass color. A logo that would get lost
 *  (Bizooma's black-and-red wordmark on a red card) goes on a white or dark
 *  rounded tag; a logo on its own solid background just gets rounded corners;
 *  anything that already stands out is drawn as is. */
function logoLook(img: HTMLImageElement, background: string): LogoLook {
  const n = 64;
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { chip: null, rounded: false };
  ctx.drawImage(img, 0, 0, n, n);
  const px = ctx.getImageData(0, 0, n, n).data;
  // Opaque corners: the logo brings its own background (a JPEG, say).
  const corner = (x: number, y: number) => px[(y * n + x) * 4 + 3]! > 245;
  if (corner(0, 0) && corner(n - 1, 0) && corner(0, n - 1) && corner(n - 1, n - 1))
    return { chip: null, rounded: true };

  // Judge by how much of the logo would get lost, not its average color: a
  // bright icon beside dark lettering averages out fine and still vanishes.
  const lums: number[] = [];
  for (let i = 0; i < px.length; i += 4)
    if (px[i + 3]! >= 128) lums.push(luminance([px[i]!, px[i + 1]!, px[i + 2]!]));
  if (!lums.length) return { chip: null, rounded: false };
  const lost = (bgL: number) => lums.filter((l) => contrastRatio(l, bgL) < 2).length / lums.length;
  if (lost(luminance(hexToRgb(background))) < 0.15) return { chip: null, rounded: false };
  // The tag color that loses the least of the logo.
  return { chip: lost(1) <= lost(luminance([20, 22, 31])) ? "#ffffff" : "#14161f", rounded: true };
}

function roundedPath(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
}

/** The logo scaled to fit its box, keeping its shape. The canvas is only as
 *  wide as the result, since Wallet left-aligns it. */
function drawLogo(img: HTMLImageElement, boxW: number, boxH: number, look: LogoLook): string {
  const w0 = img.naturalWidth || boxW;
  const h0 = img.naturalHeight || boxH;
  const pad = look.chip ? Math.round(boxH * 0.16) : 0;
  const scale = Math.min((boxW - 2 * pad) / w0, (boxH - 2 * pad) / h0);
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const c = document.createElement("canvas");
  c.width = w + 2 * pad;
  c.height = h + 2 * pad;
  const ctx = c.getContext("2d");
  if (!ctx) return toBase64Png(c);
  if (look.rounded) {
    roundedPath(ctx, c.width, c.height, Math.round(c.height * 0.22));
    ctx.clip();
  }
  if (look.chip) {
    ctx.fillStyle = look.chip;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.drawImage(img, pad, pad, w, h);
  return toBase64Png(c);
}

/** The photo center-cropped to a square with rounded corners. */
function drawSquare(img: HTMLImageElement, size: number): string {
  const w0 = img.naturalWidth || size;
  const h0 = img.naturalHeight || size;
  const side = Math.min(w0, h0);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return toBase64Png(c);
  roundedPath(ctx, size, size, Math.round(size * 0.16));
  ctx.clip();
  ctx.drawImage(img, (w0 - side) / 2, (h0 - side) / 2, side, side, 0, 0, size, size);
  return toBase64Png(c);
}

/** PNGs for the pass from signed image URLs. Send `photoUrl` only when the
 *  card shows a photo (the server also drops it on low-profile cards). */
export async function passImages(opts: {
  logoUrl?: string | null | undefined;
  photoUrl?: string | null | undefined;
  /** The pass color (the card's accent), to judge the logo against. */
  background: string;
}): Promise<Partial<Record<PassImageName, string>>> {
  const out: Partial<Record<PassImageName, string>> = {};
  const [logo, photo] = await Promise.all([
    opts.logoUrl ? loadImage(opts.logoUrl).catch(() => null) : null,
    opts.photoUrl ? loadImage(opts.photoUrl).catch(() => null) : null,
  ]);
  try {
    const look = logo ? logoLook(logo, opts.background) : null;
    for (const [name, [w, h]] of Object.entries(PASS_IMAGE_SIZES) as [
      PassImageName,
      readonly [number, number],
    ][]) {
      if (logo && look && name.startsWith("logo")) out[name] = drawLogo(logo, w, h, look);
      if (photo && name.startsWith("thumbnail")) out[name] = drawSquare(photo, w);
    }
  } catch {
    // A tainted canvas (no CORS) or an undecodable SVG: the pass goes
    // without images rather than not at all.
    return {};
  }
  return out;
}
