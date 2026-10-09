// Client-side photo preparation for AI card scanning: downscale and re-encode as
// JPEG so a pocketful of 12MP card photos fits comfortably in one request.

const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;

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
