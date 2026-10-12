import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireActiveAuth } from "@/lib/auth-guard";

// Team server functions. Only invite acceptance needs the service role (the
// joiner isn't a member yet, so RLS can't let them write the membership);
// everything else on the org page talks to Postgres directly under RLS.

const AcceptInviteSchema = z.object({ token: z.string().min(16).max(128) });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(AcceptInviteSchema)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("org_invites")
      .select("id, org_id, role, expires_at, accepted_at, orgs(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) throw new Error("This invite link is not valid.");
    if (invite.accepted_at) throw new Error("This invite link was already used.");
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error("This invite link has expired — ask for a new one.");
    }
    const { error } = await supabaseAdmin.from("org_members").insert({
      org_id: invite.org_id,
      user_id: context.userId,
      role: invite.role,
    });
    if (error) {
      if (error.code === "23505") {
        throw new Error("You're already on a team — leave it before joining another.");
      }
      throw new Error("Could not join this team. Try again.");
    }
    await supabaseAdmin
      .from("org_invites")
      .update({ accepted_by: context.userId, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    const orgName = (invite as { orgs?: { name?: string } | null }).orgs?.name ?? "your team";
    return { orgName };
  });
