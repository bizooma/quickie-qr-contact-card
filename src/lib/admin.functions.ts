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

/** Logs the real error server-side; callers only ever see a generic message. */
function adminFailure(action: string, error: { message?: string }): Error {
  console.error(`[admin] ${action} failed:`, error.message);
  return new Error(`Couldn't ${action}. Please try again.`);
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
    if (error) throw adminFailure("complete that action", error);
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
    if (error) throw adminFailure("complete that action", error);
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
    if (error) throw adminFailure("complete that action", error);
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
    if (error) throw adminFailure("complete that action", error);
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
    if (error) throw adminFailure("complete that action", error);
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
    if (error) throw adminFailure("complete that action", error);
    return { ok: true };
  });

/** Grants or removes the verified badge shown on a person's Liquid Glass
 *  cards. Owners cannot set it themselves: `verified_at` has no column grant
 *  for signed-in users, and get_public_card reads it server-side. */
export const setUserVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(TargetSchema)
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    assertOwner(context.claims);
    const { data: row, error: readError } = await admin
      .from("profiles")
      .select("verified_at")
      .eq("id", data.userId)
      .maybeSingle();
    if (readError || !row) throw adminFailure("complete that action", readError ?? {});
    const verified = !row.verified_at;
    const { error } = await admin
      .from("profiles")
      .update({ verified_at: verified ? new Date().toISOString() : null })
      .eq("id", data.userId);
    if (error) throw adminFailure("complete that action", error);
    return { ok: true, verified };
  });

/** Permanently deletes a user: auth account, rows, and stored media. */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(TargetSchema)
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    assertOwner(context.claims);
    await assertNotAdminTarget(admin, data.userId);
    // Same path as self-deletion: cancels billing, removes every upload
    // (including subfolders), then the login; rows cascade.
    const { deleteUserCompletely } = await import("./account-deletion.server");
    await deleteUserCompletely(data.userId);
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
    if (error) throw adminFailure("complete that action", error);
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
    if (error) throw adminFailure("complete that action", error);
    return { ok: true };
  });

export type DayPoint = { d: string; n: number };
export type AdminAnalytics = {
  signups: DayPoint[];
  active_users: DayPoint[];
  // Distinct people active in the window (summing the daily series would
  // count someone once per day they were active).
  active_users_total?: number;
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

export type FeatureRequestRow = {
  id: string;
  body: string;
  status: string;
  created_at: string;
  email: string | null;
  display_name: string | null;
};

/** Feature requests, newest first, with who sent them, plus roadmap vote totals. */
export const listFeatureRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    const { data: rows, error } = await admin
      .from("feature_requests")
      .select("id, body, status, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw adminFailure("load feature requests", error);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const [{ data: profiles }, users, { data: counts }] = await Promise.all([
      ids.length
        ? admin.from("profiles").select("id, display_name").in("id", ids)
        : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
      ids.length ? admin.auth.admin.listUsers({ perPage: 1000 }) : Promise.resolve(null),
      admin.rpc("roadmap_vote_counts"),
    ]);
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
    const emailOf = new Map((users?.data?.users ?? []).map((u) => [u.id, u.email ?? null]));
    const requests: FeatureRequestRow[] = (rows ?? []).map((r) => ({
      id: r.id,
      body: r.body,
      status: r.status,
      created_at: r.created_at,
      email: emailOf.get(r.user_id) ?? null,
      display_name: nameOf.get(r.user_id) ?? null,
    }));
    return { requests, votes: (counts ?? {}) as Record<string, number> };
  });

/** Triage a request; its author sees the new status on their roadmap page. */
export const setFeatureRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "planned", "in_progress", "done", "declined"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    const { error } = await admin
      .from("feature_requests")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw adminFailure("update that request", error);
    return { ok: true };
  });
