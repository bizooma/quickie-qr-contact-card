import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
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
  deleteSignupGrant,
  getAdminOverview,
  listSignupGrants,
  OWNER_EMAIL,
  setUserPlan,
  type CompTerm,
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

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

// The page is gated twice: this client check hides it, and every server
// function re-verifies profiles.is_admin with the service role.
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
  // Owner-only comp tools: the client check only hides the UI — every comp
  // server function re-verifies the JWT email against OWNER_EMAIL.
  const isOwner = user?.email?.toLowerCase() === OWNER_EMAIL;
  const { data: grants } = useQuery({
    queryKey: ["signup-grants"],
    enabled: !!me?.is_admin && isOwner,
    queryFn: () => listSignupGrants(),
  });
  const [grantEmail, setGrantEmail] = useState("");
  const [grantKind, setGrantKind] = useState("premium:life");

  if (!me) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!me.is_admin) return <p className="text-sm text-muted-foreground">Not available.</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  async function changePlan(userId: string, plan: "free" | "pro" | "premium") {
    try {
      await setUserPlan({ data: { userId, plan } });
      toast.success("Plan updated");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the plan");
    }
  }

  async function comp(userId: string, value: string) {
    try {
      await compUser({ data: { userId, ...splitComp(value) } });
      toast.success("Comped");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not comp the account");
    }
  }

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

  const tiles = [
    { label: "Users", value: data.users },
    { label: "Paid users", value: (data.plans["pro"] ?? 0) + (data.plans["premium"] ?? 0) },
    { label: "Cards", value: data.cards },
    { label: "Contacts", value: data.contacts },
    { label: "Teams", value: data.orgs },
    { label: "Views (30d)", value: data.events30["view"] ?? 0 },
    { label: "Share-backs (30d)", value: data.events30["shareback"] ?? 0 },
    {
      label: "AI calls (month)",
      value: Object.values(data.ai_month).reduce((a, b) => a + b, 0),
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <h1 className="text-3xl font-bold">Platform admin</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="surface p-4">
            <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{t.value}</p>
          </div>
        ))}
      </div>
      <section>
        <h2 className="mb-3 text-lg font-bold">Latest users</h2>
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 text-right font-medium">Cards</th>
                <th className="px-4 py-2 text-right font-medium">Contacts</th>
                <th className="px-4 py-2 text-right font-medium">AI (mo)</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                {isOwner && <th className="px-4 py-2 font-medium">Comp</th>}
              </tr>
            </thead>
            <tbody>
              {data.user_rows.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="max-w-56 px-4 py-2">
                    <p className="truncate font-medium">{u.display_name || "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                    {format(new Date(u.created_at), "MMM d, yyyy")}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
