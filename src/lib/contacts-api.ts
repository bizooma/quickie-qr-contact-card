import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Contact = Tables<"contacts"> & { tags: string[] };

export const SUGGESTED_TAGS = ["Hot lead", "Follow up", "Partner", "Customer", "Investor"];

export async function listContacts(): Promise<Contact[]> {
  const [{ data: contacts, error }, { data: tags, error: terr }] = await Promise.all([
    supabase.from("contacts").select("*").order("created_at", { ascending: false }),
    supabase.from("contact_tags").select("contact_id, tag"),
  ]);
  if (error) throw error;
  if (terr) throw terr;
  const byContact = new Map<string, string[]>();
  for (const t of tags ?? []) byContact.set(t.contact_id, [...(byContact.get(t.contact_id) ?? []), t.tag]);
  return (contacts ?? []).map((c) => ({ ...c, tags: byContact.get(c.id) ?? [] }));
}
