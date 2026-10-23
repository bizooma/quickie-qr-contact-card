import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireActiveAuth } from "@/lib/auth-guard";
import { inviteProblemMessage } from "@/lib/org-model";

// Team server functions. Only invite acceptance needs the service role (the
// joiner isn't a member yet, so RLS can't let them write the membership);
// everything else on the org page talks to Postgres directly under RLS.
// The seat and invite checks live in the accept_team_invite SQL function.

const AcceptInviteSchema = z.object({ token: z.string().min(16).max(128) });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(AcceptInviteSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // One transaction checks the invite, takes a seat and marks it used.
    const { data: result, error } = await supabaseAdmin.rpc("accept_team_invite", {
      _token: data.token,
      _user: context.userId,
    });
    if (error) throw new Error("Could not join this team. Try again.");
    const r = (result ?? {}) as { ok?: boolean; code?: string; org_name?: string | null };
    if (r.ok) return { ok: true as const, orgName: r.org_name ?? "your team" };
    // Expected refusals come back as data so the join page can explain them.
    return {
      ok: false as const,
      code: r.code ?? "invalid",
      message: inviteProblemMessage(r.code ?? "invalid", r.org_name),
    };
  });
