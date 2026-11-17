// Browser-only: draws a card's logo and photo as the PNGs a Wallet pass
// needs. Done here because the browser can decode any upload (JPEG, WebP,
// SVG); the server can't. Any image that fails to load is simply left off.

import { PASS_IMAGE_SIZES, type PassImageName } from "./apple-pass";

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

/** The logo scaled to fit its box, keeping its shape. The canvas is only as
 *  wide as the scaled logo, since Wallet left-aligns it. */
function drawLogo(img: HTMLImageElement, boxW: number, boxH: number): string {
  const w0 = img.naturalWidth || boxW;
  const h0 = img.naturalHeight || boxH;
  const scale = Math.min(boxW / w0, boxH / h0);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w0 * scale));
  c.height = Math.max(1, Math.round(h0 * scale));
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  return toBase64Png(c);
}

/** The photo center-cropped to a square. */
function drawSquare(img: HTMLImageElement, size: number): string {
  const w0 = img.naturalWidth || size;
  const h0 = img.naturalHeight || size;
  const side = Math.min(w0, h0);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  c.getContext("2d")?.drawImage(
    img,
    (w0 - side) / 2,
    (h0 - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  return toBase64Png(c);
}

/** PNGs for the pass from signed image URLs. Send `photoUrl` only when the
 *  card shows a photo (the server also drops it on low-profile cards). */
export async function passImages(opts: {
  logoUrl?: string | null | undefined;
  photoUrl?: string | null | undefined;
}): Promise<Partial<Record<PassImageName, string>>> {
  const out: Partial<Record<PassImageName, string>> = {};
  const [logo, photo] = await Promise.all([
    opts.logoUrl ? loadImage(opts.logoUrl).catch(() => null) : null,
    opts.photoUrl ? loadImage(opts.photoUrl).catch(() => null) : null,
  ]);
  try {
    for (const [name, [w, h]] of Object.entries(PASS_IMAGE_SIZES) as [
      PassImageName,
      readonly [number, number],
    ][]) {
      if (logo && name.startsWith("logo")) out[name] = drawLogo(logo, w, h);
      if (photo && name.startsWith("thumbnail")) out[name] = drawSquare(photo, w);
    }
  } catch {
    // A tainted canvas (no CORS) or an undecodable SVG: the pass goes
    // without images rather than not at all.
    return {};
  }
  return out;
}
