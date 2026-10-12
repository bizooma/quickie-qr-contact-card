import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Auth + suspension check: suspended accounts can sign in and look around,
 *  but every feature call lands here and gets turned away. The database adds
 *  a second layer (write triggers), so the UI gate is never the only thing
 *  standing between a suspended account and the product. */
export const requireActiveAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("suspended")
      .eq("id", context.userId)
      .maybeSingle();
    if (data?.suspended) {
      throw new Error("Account suspended — contact support@myaisummit.dev");
    }
    return next();
  });
