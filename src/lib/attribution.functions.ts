import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REFERRAL_BONUS_SCANS } from "./plans";

const Input = z.object({
  attrib: z.record(z.string().max(40), z.string().max(200)).optional(),
});

/** First app load after signup: records what brought the person here and,
 *  when they came from someone's card, credits that card's owner. The
 *  database function ignores accounts that are old or already recorded, so
 *  calling it again is harmless. */
export const recordSignupAttribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(Input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("record_signup_attribution", {
      _user: context.userId,
      _attrib: data.attrib ?? {},
    });
    if (error) throw new Error("Could not record signup");
    const r = (res ?? {}) as {
      stored?: boolean;
      referral?: boolean;
      owner?: string;
      bonus?: number;
    };
    if (r.referral && r.owner && (r.bonus ?? 0) > 0) {
      // Tell the card owner — best-effort, the signup is already recorded.
      try {
        const { sendPushToUser } = await import("./notify.server");
        await sendPushToUser(r.owner, {
          title: "Someone got a card from yours",
          body: `A visitor to your card created a free account — +${REFERRAL_BONUS_SCANS} card scans added for you.`,
          url: "/app/settings",
        });
      } catch {
        // push is optional
      }
    }
    return { stored: !!r.stored, referral: !!r.referral };
  });
