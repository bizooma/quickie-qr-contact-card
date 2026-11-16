import { supabase } from "@/integrations/supabase/client";

const BUCKET = "card-media";
const SIGN_SECONDS = 60 * 60 * 24 * 7;

export async function uploadCardImage(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

/** Stores a contact's photo or company logo (cropped from a scanned card or
 *  edited by the owner) under the owner's folder. */
export async function uploadContactImage(userId: string, blob: Blob): Promise<string> {
  const type = blob.type === "image/png" ? "image/png" : "image/jpeg";
  const path = `${userId}/contact-photos/${crypto.randomUUID()}.${type === "image/png" ? "png" : "jpg"}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: type, upsert: false });
  if (error) throw error;
  return path;
}

/** Downscales a large photo (e.g. a phone camera banner) to at most
 *  `maxWidth` px wide as a JPEG, so it fits the upload limit and loads fast. */
/** Downscales an upload before it goes to storage so cards load fast on a
 *  phone right after a scan. JPEG by default; `keepTransparency` keeps
 *  PNG/WebP logos as PNG. SVGs, GIFs and anything the browser can't decode
 *  go up untouched. */
export async function shrinkImage(
  file: File,
  maxWidth = 1600,
  opts: { keepTransparency?: boolean } = {},
): Promise<File> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const png = opts.keepTransparency && /image\/(png|webp)/.test(file.type);
    // Already small enough and already the right format: leave it alone.
    if (scale === 1 && (png ? file.type === "image/png" : file.type === "image/jpeg")) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = png ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], png ? "image.png" : "image.jpg", { type });
  } finally {
    bitmap.close();
  }
}

/** Stores the person's own profile photo (cropped in the photo editor). */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/avatars/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

/** Stores a contact's headshot (cropped from a scanned card) under the owner's folder. */
export const uploadContactPhoto = uploadContactImage;

/** Stores a card's Open Graph preview image at a stable per-card path. */
export async function uploadOgImage(userId: string, cardId: string, blob: Blob): Promise<string> {
  const path = `${userId}/og/${cardId}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: true });
  if (error) throw error;
  return path;
}

/** Best-effort storage cleanup; callers ignore failures (orphans are harmless). */
export async function removeMedia(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return;
  await supabase.storage.from(BUCKET).remove(list);
}

export async function signedUrls(
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const list = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (!list.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(list, SIGN_SECONDS);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const d of data) if (d.signedUrl && d.path) out[d.path] = d.signedUrl;
  return out;
}
