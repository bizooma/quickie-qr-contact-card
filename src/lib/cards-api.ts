import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { slugify, type CardData, type CardLink, type LabeledValue } from "./card-model";
import { parseTheme } from "./card-theme";
import type { ScannedCardFields } from "./own-card";

export type CardRow = Tables<"cards">;

export function rowToCard(row: CardRow, links: CardLink[]): CardData {
  return {
    slug: row.slug, label: row.label, full_name: row.full_name, job_title: row.job_title, company: row.company,
    phones: (row.phones as LabeledValue[]) ?? [], emails: (row.emails as LabeledValue[]) ?? [],
    website: row.website, location: row.location, bio: row.bio, headshot_path: row.headshot_path, logo_path: row.logo_path, logo_size: row.logo_size, banner_path: row.banner_path,
    accent_color: row.accent_color, background_color: row.background_color, font: row.font, template: row.template, theme: row.theme ? parseTheme(row.theme) : null, links,
  };
}

export async function listCards(): Promise<CardRow[]> {
  const { data, error } = await supabase.from("cards").select("*").order("created_at");
  if (error) throw error;
  return data;
}

export async function getCard(id: string) {
  const [{ data: card, error }, { data: links, error: lerr }] = await Promise.all([
    supabase.from("cards").select("*").eq("id", id).maybeSingle(),
    supabase.from("card_links").select("*").eq("card_id", id).order("position"),
  ]);
  if (error) throw error;
  if (lerr) throw lerr;
  return { card, links: (links ?? []).map((l) => ({ id: l.id, label: l.label, url: l.url, icon: l.icon })) };
}

/** Create a card with a unique slug, retrying with a numeric suffix on collision.
 *  `orgId` (plus optional brand fields) provisions a team card for `userId` —
 *  RLS lets org owners/admins do this for their members. */
export async function createCard(
  userId: string,
  input: {
    label: string;
    full_name: string;
    job_title?: string | undefined;
    company?: string | undefined;
    email?: string | undefined;
    orgId?: string | undefined;
    accentColor?: string | undefined;
    backgroundColor?: string | undefined;
  },
) {
  const base = slugify(input.full_name || input.label);
  for (let attempt = 0; attempt < 6; attempt++) {
    const slug = attempt === 0 ? base : `${base.slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("cards")
      .insert({
        user_id: userId,
        slug,
        label: input.label,
        full_name: input.full_name,
        job_title: input.job_title || null,
        company: input.company || null,
        emails: input.email ? [{ label: "Work", value: input.email }] : [],
        ...(input.orgId ? { org_id: input.orgId } : {}),
        ...(input.accentColor ? { accent_color: input.accentColor } : {}),
        ...(input.backgroundColor ? { background_color: input.backgroundColor } : {}),
      })
      .select()
      .single();
    if (!error) return data;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not find a free card address, please try again");
}

/** Creates a fully filled card from a scan of the user's own business card
 *  (see ScanMyCard). The plan's card limit still applies via createCard. */
export async function createCardFromScan(userId: string, label: string, fields: ScannedCardFields) {
  const card = await createCard(userId, {
    label,
    full_name: fields.full_name,
    job_title: fields.job_title ?? undefined,
    company: fields.company ?? undefined,
  });
  const { links, full_name: _n, job_title: _j, company: _c, ...rest } = fields;
  const { error } = await supabase.from("cards").update(rest).eq("id", card.id);
  if (error) throw error;
  if (links.length) await saveLinks(userId, card.id, links);
  return card;
}

/** Replace a card's links with the given ordered list (idempotent). */
export async function saveLinks(userId: string, cardId: string, links: CardLink[]) {
  const rows = links.map((l, i) => ({ id: l.id ?? crypto.randomUUID(), card_id: cardId, user_id: userId, label: l.label, url: l.url, icon: l.icon, position: i }));
  if (rows.length) {
    const { error } = await supabase.from("card_links").upsert(rows);
    if (error) throw error;
  }
  const keep = rows.map((r) => r.id);
  let q = supabase.from("card_links").delete().eq("card_id", cardId);
  if (keep.length) q = q.not("id", "in", `(${keep.join(",")})`);
  const { error } = await q;
  if (error) throw error;
}
