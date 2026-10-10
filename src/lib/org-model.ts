// Pure team-role logic shared by the org page and server functions.

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
