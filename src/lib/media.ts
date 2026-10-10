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

/** Stores a contact's headshot (cropped from a scanned card) under the owner's folder. */
export async function uploadContactPhoto(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/contact-photos/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

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
