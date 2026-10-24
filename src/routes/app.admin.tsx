import { appHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Fragment, useRef, useState } from "react";
import { Ban, ChevronDown, ChevronUp, KeyRound, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  addSignupGrant,
  compUser,
  deleteOrgAdmin,
  deleteSignupGrant,
  deleteUserAccount,
  getAdminAnalytics,
  getAdminOverview,
  getUserActivity,
  listSignupGrants,
  OWNER_EMAIL,
  resetUserPassword,
  setUserPlan,
  setUserSuspended,
  type AdminUserRow,
  type CompTerm,
  type DayPoint,
} from "@/lib/admin.functions";

const COMP_OPTIONS: { value: string; label: string }[] = [
  { value: "pro:month", label: "Pro · 1 month" },
  { value: "pro:year", label: "Pro · 1 year" },
  { value: "pro:life", label: "Pro · lifetime" },
  { value: "premium:month", label: "Premium · 1 month" },
  { value: "premium:year", label: "Premium · 1 year" },
  { value: "premium:life", label: "Premium · lifetime" },
];

function splitComp(value: string): { plan: "pro" | "premium"; term: CompTerm } {
  const [plan, term] = value.split(":");
  return { plan: plan as "pro" | "premium", term: term as CompTerm };
}

function compLabel(plan: string, months: number | null): string {
  const tier = plan === "premium" ? "Premium" : "Pro";
  return months === null ? `${tier} · lifetime` : `${tier} · ${months} mo`;
}

function lastSeen(iso: string | null): string {
  if (!iso) return "never";
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

/** Single-series daily bar sparkline; identity comes from the panel title,
 *  values from the per-bar tooltip. */
function Spark({ points, label }: { points: DayPoint[]; label: string }) {
  const max = Math.max(1, ...points.map((p) => p.n));
  return (
    <svg
      viewBox={`0 0 ${points.length * 8 - 2} 48`}
      className="h-12 w-full text-brand"
      role="img"
      aria-label={`${label}, last 30 days`}
      preserveAspectRatio="none"
    >
      {points.map((p, i) => {
        const h = Math.max(2, Math.round((p.n / max) * 44));
        return (
          <rect key={p.d} x={i * 8} y={48 - h} width={6} height={h} rx={2} fill="currentColor">
            <title>{`${format(new Date(p.d), "MMM d")}: ${p.n}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export const Route = createFileRoute("/app/admin")({ head: appHead('Admin', 'Administration tools.'), component: AdminPage });

// The page is gated twice: this client check hides it, and every server
// function re-verifies profiles.is_admin with the service role (destructive
// actions additionally require the owner's JWT email).
function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    enabled: !!me?.is_admin,
    queryFn: () => getAdminOverview(),
  });
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics"],
    enabled: !!me?.is_admin,
    queryFn: () => getAdminAnalytics(),
  });
  // Owner-only tools: the client check only hides the UI — every destructive
  // server function re-verifies the JWT email against OWNER_EMAIL.
  const isOwner = user?.email?.toLowerCase() === OWNER_EMAIL;
  const { data: grants } = useQuery({
    queryKey: ["signup-grants"],
    enabled: !!me?.is_admin && isOwner,
    queryFn: () => listSignupGrants(),
  });
  const [grantEmail, setGrantEmail] = useState("");
  const [grantKind, setGrantKind] = useState("premium:life");
  const [userFilter, setUserFilter] = useState<"all" | "paid" | "suspended">("all");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const usersRef = useRef<HTMLElement>(null);
  const teamsRef = useRef<HTMLElement>(null);
  const analyticsRef = useRef<HTMLElement>(null);

  const { data: activity } = useQuery({
    queryKey: ["user-activity", expandedUser],
    enabled: !!expandedUser,
    queryFn: () => getUserActivity({ data: { userId: expandedUser! } }),
  });

  if (!me) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!me.is_admin) return <p className="text-sm text-muted-foreground">Not available.</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-overview"] });

  async function run(action: () => Promise<unknown>, okMsg: string, failMsg: string) {
    try {
      await action();
      toast.success(okMsg);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failMsg);
    }
  }

  const changePlan = (userId: string, plan: "free" | "pro" | "premium") =>
    run(() => setUserPlan({ data: { userId, plan } }), "Plan updated", "Could not update");
  const comp = (userId: string, value: string) =>
    run(() => compUser({ data: { userId, ...splitComp(value) } }), "Comped", "Could not comp");
  const toggleSuspend = (u: AdminUserRow) =>
    run(
      () => setUserSuspended({ data: { userId: u.id, suspended: !u.suspended } }),
      u.suspended ? "Account restored" : "Account suspended",
      "Could not update",
    );
  const resetPw = (u: AdminUserRow) =>
    run(
      () => resetUserPassword({ data: { userId: u.id } }),
      `Password locked — reset email sent to ${u.email}`,
      "Could not reset the password",
    );
  const deleteUser = (u: AdminUserRow) =>
    run(
      () => deleteUserAccount({ data: { userId: u.id } }),
      "User deleted",
      "Could not delete the user",
    );
  const deleteTeam = (orgId: string) =>
    run(() => deleteOrgAdmin({ data: { orgId } }), "Team deleted", "Could not delete the team");

  async function addGrant() {
    const email = grantEmail.trim().toLowerCase();
    if (!email) return;
    try {
      await addSignupGrant({ data: { email, ...splitComp(grantKind), note: "Comped by admin" } });
      toast.success(`Comp queued for ${email}`);
      setGrantEmail("");
      qc.invalidateQueries({ queryKey: ["signup-grants"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not queue the comp");
    }
  }

  async function revokeGrant(id: string) {
    try {
      await deleteSignupGrant({ data: { id } });
      toast.success("Comp revoked");
      qc.invalidateQueries({ queryKey: ["signup-grants"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke the comp");
    }
  }

  const jump = (ref: React.RefObject<HTMLElement | null>, filter?: typeof userFilter) => {
    if (filter) setUserFilter(filter);
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tiles: { label: string; value: number; onClick: () => void }[] = [
    { label: "Users", value: data.users, onClick: () => jump(usersRef, "all") },
    {
      label: "Paid users",
      value: (data.plans["pro"] ?? 0) + (data.plans["premium"] ?? 0),
      onClick: () => jump(usersRef, "paid"),
    },
    { label: "Cards", value: data.cards, onClick: () => jump(usersRef, "all") },
    { label: "Contacts", value: data.contacts, onClick: () => jump(usersRef, "all") },
    { label: "Teams", value: data.orgs, onClick: () => jump(teamsRef) },
    {
      label: "Views (30d)",
      value: data.events30["view"] ?? 0,
      onClick: () => jump(analyticsRef),
    },
    {
      label: "Share-backs (30d)",
      value: data.events30["shareback"] ?? 0,
      onClick: () => jump(analyticsRef),
    },
    {
      label: "AI calls (month)",
      value: Object.values(data.ai_month).reduce((a, b) => a + b, 0),
      onClick: () => jump(analyticsRef),
    },
  ];

  const visibleUsers = data.user_rows.filter((u) =>
    userFilter === "paid"
      ? u.plan === "pro" || u.plan === "premium"
      : userFilter === "suspended"
        ? !!u.suspended
        : true,
  );

  const series: {
    key: "signups" | "active_users" | "card_views" | "sharebacks" | "ai_calls";
    label: string;
  }[] = [
    { key: "signups", label: "Sign-ups" },
    { key: "active_users", label: "Active users" },
    { key: "card_views", label: "Card views" },
    { key: "sharebacks", label: "Share-backs" },
    { key: "ai_calls", label: "AI calls" },
  ];

  return (
    <div className="space-y-8 pb-10">
      <h1 className="text-3xl font-bold">Platform admin</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.onClick}
            className="surface p-4 text-left transition-shadow hover:shadow-md"
          >
            <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{t.value}</p>
          </button>
        ))}
      </div>

      <section ref={usersRef} className="scroll-mt-6">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-lg font-bold">Users</h2>
          <Select value={userFilter} onValueChange={(v) => setUserFilter(v as typeof userFilter)}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{visibleUsers.length} shown</span>
        </div>
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 font-medium">Last seen</th>
                <th className="px-4 py-2 text-right font-medium">Cards</th>
                <th className="px-4 py-2 text-right font-medium">Contacts</th>
                <th className="px-4 py-2 text-right font-medium">AI (mo)</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                {isOwner && <th className="px-4 py-2 font-medium">Comp</th>}
                {isOwner && <th className="px-4 py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => (
                <Fragment key={u.id}>
                  <tr className={`border-b last:border-0 ${u.suspended ? "opacity-60" : ""}`}>
                    <td className="max-w-56 px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                        className="flex w-full items-center gap-1.5 text-left"
                        title="Show recent activity"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {u.display_name || "—"}
                            {u.suspended && (
                              <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                                Suspended
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {u.email}
                          </span>
                        </span>
                        {expandedUser === u.id ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                      {format(new Date(u.created_at), "MMM d, yyyy")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                      {lastSeen(u.last_seen_at)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{u.cards}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{u.contacts}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{u.ai_month}</td>
                    <td className="px-4 py-2">
                      <Select
                        value={u.plan === "pro" || u.plan === "premium" ? u.plan : "free"}
                        onValueChange={(v) => changePlan(u.id, v as "free" | "pro" | "premium")}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {isOwner && (
                      <td className="px-4 py-2">
                        <Select value="" onValueChange={(v) => comp(u.id, v)}>
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue placeholder="Comp…" />
                          </SelectTrigger>
                          <SelectContent>
                            {COMP_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    {isOwner && (
                      <td className="whitespace-nowrap px-4 py-2">
                        {u.is_admin ? (
                          <span className="text-xs text-muted-foreground">Admin</span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={u.suspended ? "Restore access" : "Suspend account"}
                              onClick={() => toggleSuspend(u)}
                            >
                              {u.suspended ? (
                                <Undo2 className="h-3.5 w-3.5" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Force password reset"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Force a password reset?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {u.email}&apos;s current password stops working immediately and
                                    they get an email with a link to set a new one. (Google sign-in
                                    keeps working — this only locks the password.)
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => resetPw(u)}>
                                    Reset password
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  title="Delete user"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete {u.email}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Permanently removes their account, cards, contacts, and stored
                                    photos. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteUser(u)}
                                  >
                                    Delete user
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                  {expandedUser === u.id && (
                    <tr className="border-b bg-muted/30 last:border-0">
                      <td colSpan={isOwner ? 9 : 7} className="px-4 py-3">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">
                          Recent activity
                        </p>
                        {!activity ? (
                          <p className="text-xs text-muted-foreground">Loading…</p>
                        ) : activity.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No activity recorded yet (tracking starts with this release).
                          </p>
                        ) : (
                          <ul className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                            {activity.map((a, i) => (
                              <li key={i} className="flex justify-between gap-2 tabular-nums">
                                <span className="truncate font-mono">{a.path}</span>
                                <span className="shrink-0 text-muted-foreground">
                                  {format(new Date(a.created_at), "MMM d, h:mm a")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section ref={teamsRef} className="scroll-mt-6">
        <h2 className="mb-3 text-lg font-bold">Teams</h2>
        <div className="surface overflow-x-auto">
          {data.org_rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No teams yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Team</th>
                  <th className="px-4 py-2 font-medium">Owner</th>
                  <th className="px-4 py-2 text-right font-medium">Seats</th>
                  <th className="px-4 py-2 text-right font-medium">Members</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  {isOwner && <th className="px-4 py-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.org_rows.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="max-w-48 truncate px-4 py-2 font-medium">{o.name}</td>
                    <td className="max-w-56 truncate px-4 py-2 text-xs text-muted-foreground">
                      {o.owner_email}
                      {o.owner_suspended && (
                        <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          Owner suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{o.seats ?? 0}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{o.members}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                      {format(new Date(o.created_at), "MMM d, yyyy")}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="Delete team"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete team “{o.name}”?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Removes the team, its memberships and pending invites. Member
                                accounts and their personal data stay. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteTeam(o.id)}
                              >
                                Delete team
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Suspend or delete individual members from the Users table above — every control there
          works on team members too.
        </p>
      </section>

      <section ref={analyticsRef} className="scroll-mt-6">
        <h2 className="mb-3 text-lg font-bold">Analytics — last 30 days</h2>
        {!analytics ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {series.map((s) => {
                const pts: DayPoint[] = analytics[s.key];
                const total =
                  s.key === "active_users" && analytics.active_users_total !== undefined
                    ? analytics.active_users_total
                    : pts.reduce((a, p) => a + p.n, 0);
                return (
                  <div key={s.key} className="surface p-4">
                    <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                    <p className="mb-2 mt-1 font-display text-2xl font-bold tabular-nums">
                      {total}
                    </p>
                    <Spark points={pts} label={s.label} />
                  </div>
                );
              })}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="surface p-4">
                <p className="mb-3 text-sm font-bold">Top cards by views</p>
                {analytics.top_cards.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No card views yet.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {analytics.top_cards.map((c) => (
                      <li key={c.slug} className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">/c/{c.slug}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {c.owner_email}
                          </span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">{c.views}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="surface p-4">
                <p className="mb-3 text-sm font-bold">Landing page events</p>
                {Object.keys(analytics.site_events30).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No events yet.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {Object.entries(analytics.site_events30).map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between">
                        <span className="font-medium">{k}</span>
                        <span className="tabular-nums text-muted-foreground">{v}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {isOwner && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Comp by email</h2>
          <div className="surface space-y-4 p-5">
            <p className="text-sm text-muted-foreground">
              Works before they sign up: the comp applies automatically the moment that email
              creates an account. Each comp is claimed once.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="email"
                aria-label="Email to comp"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                placeholder="person@example.com"
                className="h-9 w-64 text-sm"
              />
              <Select value={grantKind} onValueChange={setGrantKind}>
                <SelectTrigger className="h-9 w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMP_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addGrant} disabled={!grantEmail.trim()}>
                Queue comp
              </Button>
            </div>
            {grants && grants.length > 0 && (
              <ul className="divide-y text-sm">
                {grants.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {g.match_email ?? `name: ${g.match_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {compLabel(g.plan, g.grant_months)}
                        {g.note ? ` — ${g.note}` : ""}
                      </p>
                      {!g.match_email && (
                        <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                          Matches by name, so it only applies if they sign up with Google under
                          exactly this name. Queue their email above to be sure.
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => revokeGrant(g.id)}>
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
