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
  suspended: boolean | null;
  last_seen_at: string | null;
  created_at: string;
  cards: number;
  contacts: number;
  ai_month: number;
};

export type AdminOrgRow = {
  id: string;
  name: string;
  owner_email: string | null;
  seats: number | null;
  members: number;
  owner_suspended: boolean | null;
  created_at: string;
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
  org_rows: AdminOrgRow[];
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
      // Clear any old expiry, or a lapsed date would override the new plan.
      .update({ plan: data.plan, plan_expires_at: null })
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

// ---- Owner-only user management --------------------------------------------

type AdminClient = Awaited<ReturnType<typeof assertPlatformAdmin>>;

/** Admin accounts can never be suspended, deleted, or reset from the panel. */
async function assertNotAdminTarget(admin: AdminClient, userId: string) {
  const { data } = await admin.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (data?.is_admin) throw new Error("Admin accounts can't be changed from here.");
}

const TargetSchema = z.object({ userId: z.string().uuid() });

/** Suspends or restores an account. Suspended users can sign in, but every
 *  feature call and database write is refused until support clears them. */
export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(TargetSchema.extend({ suspended: z.boolean() }))
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    assertOwner(context.claims);
    await assertNotAdminTarget(admin, data.userId);
    const { error } = await admin
      .from("profiles")
      .update({
        suspended: data.suspended,
        suspended_at: data.suspended ? new Date().toISOString() : null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Permanently deletes a user: auth account, rows, and stored media. */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(TargetSchema)
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    assertOwner(context.claims);
    await assertNotAdminTarget(admin, data.userId);
    // Media first (nothing references it): the user's folder plus subfolders.
    for (const prefix of [data.userId, `${data.userId}/contact-photos`, `${data.userId}/og`]) {
      const { data: files } = await admin.storage.from("card-media").list(prefix, { limit: 1000 });
      const paths = (files ?? [])
        .filter((f) => f.id !== null) // folders list with id null
        .map((f) => `${prefix}/${f.name}`);
      if (paths.length) await admin.storage.from("card-media").remove(paths);
    }
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    // Belt and braces for rows that might not cascade from auth.users.
    await admin.from("profiles").delete().eq("id", data.userId);
    return { ok: true };
  });

/** Locks the current password (scrambled server-side) and emails the user a
 *  reset link, so their next sign-in forces a new password. */
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(TargetSchema)
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    assertOwner(context.claims);
    await assertNotAdminTarget(admin, data.userId);
    const { data: target, error: lookupError } = await admin.auth.admin.getUserById(data.userId);
    if (lookupError || !target?.user?.email) throw new Error("Could not find that user.");
    const scrambled = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { error: lockError } = await admin.auth.admin.updateUserById(data.userId, {
      password: scrambled,
    });
    if (lockError) throw new Error(lockError.message);
    const { error: mailError } = await admin.auth.resetPasswordForEmail(target.user.email, {
      redirectTo: "https://contactkickstart.com/auth/reset",
    });
    if (mailError) throw new Error(`Password locked, but the email failed: ${mailError.message}`);
    return { ok: true, email: target.user.email };
  });

/** A user's recent in-app activity (what they opened, newest first). */
export const getUserActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(TargetSchema)
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    const { data: rows, error } = await admin
      .from("user_activity")
      .select("path, created_at")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Deletes a team (org + memberships + invites); member accounts stay. */
export const deleteOrgAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ orgId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    assertOwner(context.claims);
    await admin.from("org_invites").delete().eq("org_id", data.orgId);
    await admin.from("org_members").delete().eq("org_id", data.orgId);
    const { error } = await admin.from("orgs").delete().eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type DayPoint = { d: string; n: number };
export type AdminAnalytics = {
  signups: DayPoint[];
  active_users: DayPoint[];
  card_views: DayPoint[];
  sharebacks: DayPoint[];
  ai_calls: DayPoint[];
  top_cards: { slug: string; label: string; owner_email: string; views: number }[];
  site_events30: Record<string, number>;
};

/** 30-day platform analytics for the admin dashboard. */
export const getAdminAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAnalytics> => {
    const admin = await assertPlatformAdmin(context.userId);
    const { data, error } = await admin.rpc("admin_analytics");
    if (error || !data) throw new Error("Could not load analytics.");
    return data as unknown as AdminAnalytics;
  });
