import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireActiveAuth } from "@/lib/auth-guard";
import { CLIO_REGIONS, cleanClioToken, tokenHint } from "./crm";

// CRM server functions. crm_connections is invisible to every client role,
// so all of it goes through here with the service role, scoped to the
// signed-in user. CRM sync is a paid feature, offered on attorney cards.

async function paidPlan(userId: string): Promise<boolean> {
  const { getPlan } = await import("./usage.server");
  return (await getPlan(userId)) !== "free";
}

export type CrmState = {
  /** The account has at least one attorney card (the only place CRM shows). */
  eligible: boolean;
  paid: boolean;
  clio: { region: string; hint: string | null; lastError: string | null } | null;
};

export const getCrmState = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .handler(async ({ context }): Promise<CrmState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: cards }, { data: conn }, paid] = await Promise.all([
      supabaseAdmin.from("cards").select("practice").eq("user_id", context.userId),
      supabaseAdmin
        .from("crm_connections")
        .select("region, secret_hint, last_error")
        .eq("user_id", context.userId)
        .eq("provider", "clio_grow")
        .maybeSingle(),
      paidPlan(context.userId),
    ]);
    const { parsePractice } = await import("./practice");
    return {
      eligible: (cards ?? []).some((c) => parsePractice(c.practice)?.kind === "attorney"),
      paid,
      clio: conn
        ? { region: conn.region ?? "us", hint: conn.secret_hint, lastError: conn.last_error }
        : null,
    };
  });

export const connectClioGrow = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(z.object({ token: z.string().max(300), region: z.enum(CLIO_REGIONS) }))
  .handler(async ({ data, context }) => {
    if (!(await paidPlan(context.userId)))
      throw new Error("Sending leads to Clio Grow comes with Pro.");
    const token = cleanClioToken(data.token);
    if (!token)
      throw new Error("That doesn't look like a lead capture token. Copy it again from Clio Grow.");
    const { checkClioToken } = await import("./crm.server");
    const check = await checkClioToken(token, data.region);
    if (check === "invalid")
      throw new Error(
        "Clio Grow didn't accept that token. Check you copied the whole lead capture token, and that the region matches your Clio account.",
      );
    if (check === "unknown")
      throw new Error("Couldn't reach Clio Grow to check the token. Try again in a minute.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_connections").upsert({
      user_id: context.userId,
      provider: "clio_grow",
      region: data.region,
      secret: token,
      secret_hint: tokenHint(token),
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Couldn't save the connection. Try again.");
    return { ok: true };
  });

export const disconnectClioGrow = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("crm_connections")
      .delete()
      .eq("user_id", context.userId)
      .eq("provider", "clio_grow");
    return { ok: true };
  });

/** Sends (or resends) one of the user's contacts to Clio Grow. */
export const sendContactToClio = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(z.object({ contactId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await paidPlan(context.userId)))
      throw new Error("Sending leads to Clio Grow comes with Pro.");
    const { sendContactToCrm } = await import("./crm.server");
    const result = await sendContactToCrm(context.userId, data.contactId);
    if (!result.ok) throw new Error(result.error);
    return { ok: true };
  });
