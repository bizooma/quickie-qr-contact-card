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

// Comping plans is owner-only (not every admin): the JWT email must match.
export const OWNER_EMAIL = "kale@myaisummit.dev";

function assertOwner(claims: Record<string, unknown>) {
  const email = typeof claims["email"] === "string" ? claims["email"].toLowerCase() : "";
  if (email !== OWNER_EMAIL) throw new Error("Not available.");
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

// ---- Owner-only comps -------------------------------------------------------

export const COMP_TERMS = ["month", "year", "life"] as const;
export type CompTerm = (typeof COMP_TERMS)[number];

const CompSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(["pro", "premium"]),
  term: z.enum(COMP_TERMS),
});

function termMonths(term: CompTerm): number | null {
  return term === "month" ? 1 : term === "year" ? 12 : null;
}

function expiresAt(term: CompTerm): string | null {
  const months = termMonths(term);
  if (months === null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

/** Comps an existing account: pro/premium for a month, a year, or for life.
 *  A live Stripe subscription will overwrite this on its next webhook event. */
export const compUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(CompSchema)
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    assertOwner(context.claims);
    const { error } = await admin
      .from("profiles")
      .update({ plan: data.plan, plan_expires_at: expiresAt(data.term) })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const GrantSchema = z.object({
  email: z.string().email(),
  plan: z.enum(["pro", "premium"]),
  term: z.enum(COMP_TERMS),
  note: z.string().max(200).optional(),
});

/** Queues a comp for someone who hasn't signed up yet: the signup trigger
 *  applies it (claim-once) the moment that email creates an account. */
export const addSignupGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(GrantSchema)
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    assertOwner(context.claims);
    const { error } = await admin.from("signup_grants").insert({
      match_email: data.email.toLowerCase(),
      plan: data.plan,
      grant_months: termMonths(data.term),
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type SignupGrantRow = {
  id: string;
  match_email: string | null;
  match_name: string | null;
  plan: string;
  grant_months: number | null;
  note: string | null;
  created_at: string;
};

/** Pending (unclaimed) signup grants, newest first. */
export const listSignupGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignupGrantRow[]> => {
    const admin = await assertPlatformAdmin(context.userId);
    assertOwner(context.claims);
    const { data, error } = await admin
      .from("signup_grants")
      .select("id, match_email, match_name, plan, grant_months, note, created_at")
      .is("claimed_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Revokes a pending grant before anyone claims it. */
export const deleteSignupGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    assertOwner(context.claims);
    const { error } = await admin
      .from("signup_grants")
      .delete()
      .eq("id", data.id)
      .is("claimed_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
