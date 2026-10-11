import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, Link2, Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  canChangeRole,
  canRemoveMember,
  inviteUrl,
  isOrgAdmin,
  newInviteToken,
  ROLE_LABELS,
  type OrgRole,
} from "@/lib/org-model";
import { createCard } from "@/lib/cards-api";
import { initials } from "@/lib/card-model";

export const Route = createFileRoute("/app/org")({ component: OrgPage });

async function loadTeam(userId: string) {
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return null;
  const [{ data: org }, { data: members }, { data: invites }, { data: teamCards }] =
    await Promise.all([
      supabase.from("orgs").select("*").eq("id", membership.org_id).maybeSingle(),
      supabase.from("org_members").select("*").eq("org_id", membership.org_id).order("created_at"),
      supabase
        .from("org_invites")
        .select("*")
        .eq("org_id", membership.org_id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("cards").select("*").eq("org_id", membership.org_id).order("created_at"),
    ]);
  if (!org) return null;
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  return {
    org,
    role: membership.role as OrgRole,
    members: members ?? [],
    invites: invites ?? [],
    teamCards: teamCards ?? [],
    names: Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name ?? ""])),
  };
}

function OrgPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: team, isLoading } = useQuery({
    queryKey: ["team"],
    enabled: !!user,
    queryFn: () => loadTeam(user!.id),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["team"] });

  if (!user || isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!team) return <CreateTeam onCreated={refresh} />;

  const { org, role, members, invites, teamCards, names } = team;
  const admin = isOrgAdmin(role);

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-10">
      <div>
        <h1 className="text-3xl font-bold">{org.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {members.length} member{members.length === 1 ? "" : "s"} · you're{" "}
          {ROLE_LABELS[role].toLowerCase()}
        </p>
      </div>

      <MembersSection
        myId={user.id}
        myRole={role}
        members={members}
        names={names}
        onChanged={refresh}
      />

      {admin && <InvitesSection orgId={org.id} invites={invites} onChanged={refresh} />}

      {admin && (
        <TeamCardsSection
          org={org}
          members={members}
          names={names}
          teamCards={teamCards}
          onChanged={refresh}
        />
      )}

      {admin && <TeamAnalytics teamCards={teamCards} names={names} />}

      {admin && <BrandSection org={org} onChanged={refresh} />}
    </div>
  );
}

function CreateTeam({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!user) return;
    setBusy(true);
    try {
      const { data: org, error } = await supabase
        .from("orgs")
        .insert({ name: name.trim(), owner_id: user.id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const { error: merr } = await supabase
        .from("org_members")
        .insert({ org_id: org.id, user_id: user.id, role: "owner" });
      if (merr) throw new Error(merr.message);
      toast.success(`Team "${org.name}" created`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the team");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pt-10 text-center">
      <Users className="mx-auto h-10 w-10 text-brand" />
      <h1 className="text-2xl font-bold">Create your team</h1>
      <p className="text-sm text-muted-foreground">
        Invite teammates with a link, provision branded cards for them, and see team analytics in
        one place. Creating a team requires a Premium plan; members can be on any plan.
      </p>
      <div className="space-y-2 text-left">
        <Label htmlFor="team-name">Team name</Label>
        <Input
          id="team-name"
          placeholder="e.g. Acme Sales"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <Button className="w-full" disabled={busy || name.trim().length < 2} onClick={create}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Create team
      </Button>
      <p className="text-xs text-muted-foreground">
        Got an invite link from someone? Just open it while signed in.
      </p>
    </div>
  );
}

type MemberRow = { org_id: string; user_id: string; role: string };

function MembersSection({
  myId,
  myRole,
  members,
  names,
  onChanged,
}: {
  myId: string;
  myRole: OrgRole;
  members: MemberRow[];
  names: Record<string, string>;
  onChanged: () => void;
}) {
  async function remove(m: MemberRow) {
    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("org_id", m.org_id)
      .eq("user_id", m.user_id);
    if (error) toast.error(error.message);
    else {
      toast.success(m.user_id === myId ? "You left the team" : "Member removed");
      onChanged();
    }
  }
  async function setRole(m: MemberRow, role: string) {
    const { error } = await supabase
      .from("org_members")
      .update({ role })
      .eq("org_id", m.org_id)
      .eq("user_id", m.user_id);
    if (error) toast.error(error.message);
    else onChanged();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Members</h2>
      <ul className="surface divide-y">
        {members.map((m) => {
          const name = names[m.user_id] || "Teammate";
          const self = m.user_id === myId;
          const targetRole = m.role as OrgRole;
          return (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-accent-foreground">
                {initials(name)}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {name}
                {self && <span className="text-muted-foreground"> (you)</span>}
              </span>
              {canChangeRole(myRole, targetRole) && !self ? (
                <Select value={m.role} onValueChange={(v) => setRole(m, v)}>
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[targetRole]}</span>
              )}
              {canRemoveMember(myRole, targetRole, self) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remove(m)}
                >
                  {self ? "Leave" : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type InviteRow = { id: string; token: string; role: string; expires_at: string };

function InvitesSection({
  orgId,
  invites,
  onChanged,
}: {
  orgId: string;
  invites: InviteRow[];
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [role, setRole] = useState("member");

  async function createInvite() {
    const { error } = await supabase
      .from("org_invites")
      .insert({ org_id: orgId, token: newInviteToken(), role, created_by: user!.id });
    if (error) toast.error(error.message);
    else onChanged();
  }
  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(window.location.origin, token));
      toast.success("Invite link copied — send it to your teammate");
    } catch {
      toast.error("Could not copy the link");
    }
  }
  async function del(id: string) {
    const { error } = await supabase.from("org_invites").delete().eq("id", id);
    if (error) toast.error(error.message);
    else onChanged();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Invite links</h2>
      <div className="flex gap-2">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={createInvite}>
          <Link2 className="h-4 w-4" />
          New invite link
        </Button>
      </div>
      {invites.length > 0 && (
        <ul className="surface divide-y">
          {invites.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                …{i.token.slice(-10)} · {i.role} · expires{" "}
                {new Date(i.expires_at).toLocaleDateString()}
              </span>
              <Button size="sm" variant="outline" onClick={() => copy(i.token)}>
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => del(i.id)} aria-label="Revoke">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Each link works once and expires after 14 days. The teammate opens it while signed in.
      </p>
    </section>
  );
}

type OrgRow = {
  id: string;
  name: string;
  accent_color: string | null;
  background_color: string | null;
  lock_brand: boolean;
  share_contacts: boolean;
};
type CardRowLite = { id: string; user_id: string; label: string; slug: string };

function TeamCardsSection({
  org,
  members,
  names,
  teamCards,
  onChanged,
}: {
  org: OrgRow;
  members: MemberRow[];
  names: Record<string, string>;
  teamCards: CardRowLite[];
  onChanged: () => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [label, setLabel] = useState("Team");
  const [busy, setBusy] = useState(false);

  async function provision() {
    setBusy(true);
    try {
      await createCard(memberId, {
        label: label.trim() || "Team",
        full_name: names[memberId] || "",
        company: org.name,
        orgId: org.id,
        accentColor: org.accent_color ?? undefined,
        backgroundColor: org.background_color ?? undefined,
      });
      toast.success("Team card created");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the card");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Team cards</h2>
      {teamCards.length > 0 && (
        <ul className="surface divide-y">
          {teamCards.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground"> · {names[c.user_id] || "Teammate"}</span>
              </span>
              <a
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                href={`/c/${c.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                /c/{c.slug}
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Select value={memberId} onValueChange={setMemberId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Pick a member" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {names[m.user_id] || "Teammate"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-36"
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button disabled={!memberId || busy} onClick={provision}>
          <Plus className="h-4 w-4" />
          Provision card
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Team cards don't count against members' personal card limits and follow the team brand when
        it's locked below.
      </p>
    </section>
  );
}

function TeamAnalytics({
  teamCards,
  names,
}: {
  teamCards: CardRowLite[];
  names: Record<string, string>;
}) {
  const cardIds = useMemo(() => teamCards.map((c) => c.id), [teamCards]);
  const { data: events = [] } = useQuery({
    queryKey: ["team-events", cardIds],
    enabled: cardIds.length > 0,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data, error } = await supabase
        .from("card_views")
        .select("card_id, event_type")
        .in("card_id", cardIds)
        .gte("created_at", since)
        .limit(10000);
      if (error) throw error;
      return data;
    },
  });
  if (!cardIds.length) return null;
  const totals = { view: 0, save: 0, shareback: 0 } as Record<string, number>;
  for (const e of events)
    if (e.event_type in totals) totals[e.event_type] = (totals[e.event_type] ?? 0) + 1;
  const byCard = new Map<string, number>();
  for (const e of events)
    if (e.event_type === "view") byCard.set(e.card_id, (byCard.get(e.card_id) ?? 0) + 1);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Team analytics (30 days)</h2>
      <div className="grid grid-cols-3 gap-3">
        {(["view", "save", "shareback"] as const).map((k) => (
          <div key={k} className="surface p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {k === "view" ? "Views" : k === "save" ? "Saves" : "Share-backs"}
            </p>
            <p className="mt-1 font-display text-3xl font-bold">{totals[k]}</p>
          </div>
        ))}
      </div>
      {teamCards.length > 1 && (
        <ul className="surface divide-y text-sm">
          {teamCards.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="truncate">
                {c.label} · {names[c.user_id] || "Teammate"}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {byCard.get(c.id) ?? 0} views
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BrandSection({ org, onChanged }: { org: OrgRow; onChanged: () => void }) {
  const [accent, setAccent] = useState(org.accent_color ?? "#E8553D");
  const [background, setBackground] = useState(org.background_color ?? "#FFFFFF");

  async function save(patch: Partial<OrgRow>) {
    const { error } = await supabase.from("orgs").update(patch).eq("id", org.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Team settings saved");
      onChanged();
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">Brand & sharing</h2>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>Accent</Label>
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value.toUpperCase())}
            className="h-9 w-16 cursor-pointer rounded-md border"
          />
        </div>
        <div className="space-y-1">
          <Label>Background</Label>
          <input
            type="color"
            value={background}
            onChange={(e) => setBackground(e.target.value.toUpperCase())}
            className="h-9 w-16 cursor-pointer rounded-md border"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => save({ accent_color: accent, background_color: background })}
        >
          Save colors
        </Button>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Lock brand on team cards</p>
          <p className="text-xs text-muted-foreground">
            Team cards always use the colors above; members can't change them.
          </p>
        </div>
        <Switch
          checked={org.lock_brand}
          onCheckedChange={(v) => save({ lock_brand: v })}
          aria-label="Lock brand"
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Shared contact pool</p>
          <p className="text-xs text-muted-foreground">
            Everyone on the team can view (not edit) each other's captured contacts.
          </p>
        </div>
        <Switch
          checked={org.share_contacts}
          onCheckedChange={(v) => save({ share_contacts: v })}
          aria-label="Shared contacts"
        />
      </div>
    </section>
  );
}
