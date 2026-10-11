import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Platform-admin server functions: every handler re-checks profiles.is_admin
// with the service role, so hiding the UI is cosmetic, not the security.

async function assertPlatformAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.is_admin) throw new Error("Not available.");
  return supabaseAdmin;
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: string | null;
  is_admin: boolean | null;
  created_at: string;
  cards: number;
  contacts: number;
  ai_month: number;
};

export type AdminOverview = {
  users: number;
  cards: number;
  contacts: number;
  orgs: number;
  plans: Record<string, number>;
  events30: Record<string, number>;
  ai_month: Record<string, number>;
  user_rows: AdminUserRow[];
};

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const admin = await assertPlatformAdmin(context.userId);
    const { data, error } = await admin.rpc("admin_overview");
    if (error || !data) throw new Error("Could not load the overview.");
    return data as unknown as AdminOverview;
  });

const SetPlanSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(["free", "pro", "premium"]),
});

/** Comp or downgrade an account by hand (Stripe subscriptions stay untouched). */
export const setUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(SetPlanSchema)
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    const { error } = await admin
      .from("profiles")
      .update({ plan: data.plan })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
