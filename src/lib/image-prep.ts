// Client-side photo preparation for AI card scanning: downscale and re-encode as
// JPEG so a pocketful of 12MP card photos fits comfortably in one request.

import type { HeadshotBox } from "./ai-model";
import { headshotCropRect } from "./headshot";

const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;
const HEADSHOT_MAX_DIMENSION = 512;

export type PreparedImage = {
  data: string; // base64, no data: prefix
  media_type: "image/jpeg";
  previewUrl: string;
};

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose image files");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process the image in this browser");
    // Card photos can be PNGs with transparency; JPEG needs an opaque background.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const previewUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return { data: previewUrl.split(",")[1] ?? "", media_type: "image/jpeg", previewUrl };
  } finally {
    bitmap.close();
  }
}

export type CroppedHeadshot = { blob: Blob; previewUrl: string };

/** Crops the AI-reported headshot box out of a prepared card photo. Null when the
 *  box fails sanity checks — a missing headshot is never an error. */
export async function cropHeadshot(
  image: PreparedImage,
  box: HeadshotBox | null,
): Promise<CroppedHeadshot | null> {
  if (!box) return null;
  const bitmap = await createImageBitmap(await (await fetch(image.previewUrl)).blob());
  try {
    const rect = headshotCropRect(bitmap.width, bitmap.height, box);
    if (!rect) return null;
    const scale = Math.min(1, HEADSHOT_MAX_DIMENSION / Math.max(rect.w, rect.h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.w * scale));
    canvas.height = Math.max(1, Math.round(rect.h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    return blob ? { blob, previewUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY) } : null;
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}
