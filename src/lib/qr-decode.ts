// Browser-side QR detection inside scanned photos. Uses the native
// BarcodeDetector where available (Chromium, Android) and falls back to the
// jsQR wasm-free decoder elsewhere (Safari). Parsing lives in scan-decode.ts.

import type { PreparedImage } from "./image-prep";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmap) => Promise<{ rawValue: string }[]>;
};

function nativeDetector(): BarcodeDetectorLike | null {
  const Ctor = (globalThis as Record<string, unknown>)["BarcodeDetector"] as
    (new (opts: { formats: string[] }) => BarcodeDetectorLike) | undefined;
  try {
    return Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

/** Returns the decoded text of the first QR code in the image, or null. */
export async function decodeQrFromImage(image: PreparedImage): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(await (await fetch(image.previewUrl)).blob());
  } catch {
    return null;
  }
  try {
    const native = nativeDetector();
    if (native) {
      try {
        const found = await native.detect(bitmap);
        const value = found[0]?.rawValue?.trim();
        if (value) return value;
      } catch {
        // Fall through to jsQR.
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { default: jsQR } = await import("jsqr");
    const hit = jsQR(data.data, data.width, data.height);
    return hit?.data?.trim() || null;
  } finally {
    bitmap.close();
  }
}
