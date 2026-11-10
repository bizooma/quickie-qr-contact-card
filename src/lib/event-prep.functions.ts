import { createServerFn } from "@tanstack/react-start";
import { requireActiveAuth } from "@/lib/auth-guard";
import type { PrepResult } from "./event-prep";

/** The Event Prep content, for accounts that have paid for anything: a Pro,
 *  Premium or team plan, or any purchase on the account (starter pack,
 *  founding offer) that hasn't been refunded. Everyone else gets a locked
 *  marker and no content, so the page gate is not the only gate. */
export const getEventPrep = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .handler(async ({ context }): Promise<PrepResult> => {
    const { getPlan } = await import("./usage.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let paid = (await getPlan(context.userId)) !== "free";
    if (!paid) {
      const { count } = await supabaseAdmin
        .from("purchase_entitlements")
        .select("id", { count: "exact", head: true })
        .eq("applied_to", context.userId)
        .eq("is_test", false)
        .is("refunded_at", null);
      paid = (count ?? 0) > 0;
    }
    if (!paid) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("is_admin")
        .eq("id", context.userId)
        .maybeSingle();
      paid = data?.is_admin === true;
    }
    if (!paid) return { locked: true };

    const { EVENT_PREP } = await import("./event-prep-content.server");
    return { locked: false, content: EVENT_PREP };
  });
