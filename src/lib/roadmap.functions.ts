import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireActiveAuth } from "@/lib/auth-guard";
import { cleanRequest, REQUESTS_PER_DAY } from "./roadmap";

/** Sends a feature request: rate-limited per person, then a push to the
 *  platform admins so nothing sits unread. Authors read their own requests
 *  back through RLS (feature_requests is select-own). */
export const submitFeatureRequest = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(z.object({ text: z.string().max(4000) }))
  .handler(async ({ data, context }) => {
    const cleaned = cleanRequest(data.text);
    if (!cleaned.ok) throw new Error(cleaned.error);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("feature_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= REQUESTS_PER_DAY) {
      throw new Error("Thanks for all the ideas! You can send more tomorrow.");
    }

    const { error } = await supabaseAdmin
      .from("feature_requests")
      .insert({ user_id: context.userId, body: cleaned.text });
    if (error) throw new Error("Couldn't send your request. Please try again.");

    try {
      const { data: admins } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("is_admin", true);
      const { sendPushToUser } = await import("./notify.server");
      await Promise.all(
        (admins ?? []).map((a) =>
          sendPushToUser(a.id, {
            title: "New feature request",
            body: cleaned.text.slice(0, 140),
            url: "/app/admin",
          }),
        ),
      );
    } catch {
      // The request is saved; the push is a courtesy.
    }
    return { ok: true };
  });
