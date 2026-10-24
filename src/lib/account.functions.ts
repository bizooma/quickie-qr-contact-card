import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the caller's data, uploaded images, billing and login. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Caller identity was verified by the middleware; the rest runs as admin so
    // the subscription is cancelled and every upload goes, not just the top folder.
    const { deleteUserCompletely } = await import("./account-deletion.server");
    await deleteUserCompletely(context.userId);
    return { ok: true };
  });
