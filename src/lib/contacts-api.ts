import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Contact = Tables<"contacts"> & { tags: string[] };

export const SUGGESTED_TAGS = ["Hot lead", "Follow up", "Partner", "Customer", "Investor"];

// The API answers at most 1,000 rows per request; page until a short page.
const PAGE = 1000;
async function allPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export async function listContacts(): Promise<Contact[]> {
  const [contacts, tags] = await Promise.all([
    allPages<Tables<"contacts">>((from, to) =>
      supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    allPages<{ contact_id: string; tag: string }>((from, to) =>
      supabase.from("contact_tags").select("contact_id, tag").order("id").range(from, to),
    ),
  ]);
  const byContact = new Map<string, string[]>();
  for (const t of tags)
    byContact.set(t.contact_id, [...(byContact.get(t.contact_id) ?? []), t.tag]);
  return contacts.map((c) => ({ ...c, tags: byContact.get(c.id) ?? [] }));
}
