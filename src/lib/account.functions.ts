import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the caller's data, uploaded images, and login. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Remove user-owned rows as the user (RLS-scoped). Children cascade from cards/contacts.
    for (const table of ["contact_tags", "contact_notes", "contacts", "card_views", "card_links", "cards"] as const) {
      const { error } = await supabase.from(table).delete().eq("user_id", userId);
      if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
    }
    const { data: files } = await supabase.storage.from("card-media").list(userId, { limit: 1000 });
    if (files?.length) await supabase.storage.from("card-media").remove(files.map((f) => `${userId}/${f.name}`));

    // Deleting the login itself requires admin rights; caller identity was verified by middleware.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Could not delete login: ${error.message}`);
    return { ok: true };
  });
