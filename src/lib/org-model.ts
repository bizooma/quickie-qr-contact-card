// Pure team-role logic shared by the org page and server functions.

import { TEAM_MIN_SEATS } from "./plans";

export type OrgRole = "owner" | "admin" | "member";

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function isOrgAdmin(role: OrgRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Owners manage every role; admins manage members; nobody removes the owner. */
export function canRemoveMember(actor: OrgRole, targetRole: OrgRole, isSelf: boolean): boolean {
  if (isSelf) return targetRole !== "owner"; // anyone but the owner can leave
  if (targetRole === "owner") return false;
  return isOrgAdmin(actor);
}

/** Only the owner changes roles, and never their own owner row. */
export function canChangeRole(actor: OrgRole, targetRole: OrgRole): boolean {
  return actor === "owner" && targetRole !== "owner";
}

export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/app/join/${token}`;
}

export function newInviteToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

/** The team RPC exposes names only, never another member's private profile. */
export function teamNames(rows: ReadonlyArray<{ id: string; display_name: string | null }>): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.id, row.display_name ?? ""]));
}

// ---- Seats ----------------------------------------------------------------
// Mirrors has_team_seat in SQL (migration 0023): the owner first, then members
// in the order they joined. Only the first `seats` people get the team's
// Premium, so lowering seats drops the newest members first.

type SeatMember = { user_id: string; role: string; created_at: string };

export function seatOrder<T extends SeatMember>(members: readonly T[]): T[] {
  return [...members].sort(
    (a, b) =>
      Number(a.role !== "owner") - Number(b.role !== "owner") ||
      a.created_at.localeCompare(b.created_at) ||
      a.user_id.localeCompare(b.user_id),
  );
}

/** Members without a seat: everyone past the limit, or the whole team when
 *  it's under the 3-seat minimum (e.g. the Teams plan was cancelled). */
export function uncoveredMembers<T extends SeatMember>(members: readonly T[], seats: number): T[] {
  const ordered = seatOrder(members);
  return seats < TEAM_MIN_SEATS ? ordered : ordered.slice(seats);
}

// ---- Invite acceptance -------------------------------------------------------

export type InviteProblem = "invalid" | "used" | "expired" | "other_team" | "seats_full";

/** What the join page says for each reason accept_team_invite can refuse. */
export function inviteProblemMessage(
  code: InviteProblem | string,
  teamName?: string | null,
): string {
  const team = teamName?.trim() || "This team";
  switch (code) {
    case "seats_full":
      return `${team} has no free seats right now. Ask the team owner to add a seat (Settings → Manage billing), then open this link again.`;
    case "used":
      return "This invite link was already used. Ask the team owner for a new one.";
    case "expired":
      return "This invite link has expired. Ask the team owner for a new one.";
    case "other_team":
      return "You're already on another team. Leave it from the Team page before joining this one.";
    default:
      return "This invite link is not valid. Check you copied the whole link, or ask for a new one.";
  }
}
