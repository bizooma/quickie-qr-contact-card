import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Lightweight presence tracking for the admin dashboard: which screens a
// signed-in user opened and when they were last online. Fire-and-forget
// from the app layout; never user-facing.

const TrackSchema = z.object({ path: z.string().min(1).max(200) });

export const trackActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(TrackSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", context.userId);
    // Skip a duplicate row when the latest entry is the same screen within
    // five minutes — keeps the log readable and small.
    const { data: last } = await supabaseAdmin
      .from("user_activity")
      .select("path, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    if (last && last.path === data.path && new Date(last.created_at).getTime() > fiveMinAgo) {
      return { ok: true };
    }
    await supabaseAdmin.from("user_activity").insert({ user_id: context.userId, path: data.path });
    // Rolling 90-day retention, pruned opportunistically.
    await supabaseAdmin
      .from("user_activity")
      .delete()
      .eq("user_id", context.userId)
      .lt("created_at", new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString());
    return { ok: true };
  });
