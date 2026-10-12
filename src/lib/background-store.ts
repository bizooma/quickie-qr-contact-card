// Saved virtual-background designs (browser client, RLS: owner only).
// One design per card; uploaded pictures sit in the private card-media
// bucket under the owner's folder and are referenced from the design.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { designMediaPaths, ownPaths, parseDesign, type Design } from "./background";

const BUCKET = "card-media";

/** The card's saved design, or null when there is none (or it's unreadable). */
export async function loadDesign(cardId: string): Promise<Design | null> {
  const { data, error } = await supabase
    .from("background_designs")
    .select("design")
    .eq("card_id", cardId)
    .maybeSingle();
  if (error) throw error;
  return data ? parseDesign(data.design) : null;
}

export async function saveDesign(userId: string, cardId: string, design: Design): Promise<void> {
  const { error } = await supabase.from("background_designs").upsert({
    card_id: cardId,
    user_id: userId,
    design: design as unknown as Json,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Uploads a picture for a background and returns its storage path. */
export async function uploadBackgroundImage(userId: string, blob: Blob): Promise<string> {
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return path;
}

/** Files a card's saved design uploaded, so they can be removed after the
 *  card is deleted (the design row itself cascades). Best-effort. */
export async function designUploads(userId: string, cardId: string): Promise<string[]> {
  try {
    const design = await loadDesign(cardId);
    return design ? ownPaths(userId, designMediaPaths(design)) : [];
  } catch {
    return [];
  }
}
