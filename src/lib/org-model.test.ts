import { describe, expect, it } from "vitest";
import {
  canChangeRole,
  canRemoveMember,
  inviteProblemMessage,
  inviteUrl,
  isOrgAdmin,
  newInviteToken,
  seatOrder,
  teamNames,
  uncoveredMembers,
} from "./org-model";

describe("isOrgAdmin", () => {
  it("treats owner and admin as managers", () => {
    expect(isOrgAdmin("owner")).toBe(true);
    expect(isOrgAdmin("admin")).toBe(true);
    expect(isOrgAdmin("member")).toBe(false);
    expect(isOrgAdmin(null)).toBe(false);
  });
});

describe("canRemoveMember", () => {
  it("lets admins remove members but never the owner", () => {
    expect(canRemoveMember("admin", "member", false)).toBe(true);
    expect(canRemoveMember("owner", "admin", false)).toBe(true);
    expect(canRemoveMember("admin", "owner", false)).toBe(false);
    expect(canRemoveMember("member", "member", false)).toBe(false);
  });
  it("lets anyone but the owner leave", () => {
    expect(canRemoveMember("member", "member", true)).toBe(true);
    expect(canRemoveMember("owner", "owner", true)).toBe(false);
  });
});

describe("canChangeRole", () => {
  it("is owner-only and never touches the owner row", () => {
    expect(canChangeRole("owner", "member")).toBe(true);
    expect(canChangeRole("owner", "admin")).toBe(true);
    expect(canChangeRole("owner", "owner")).toBe(false);
    expect(canChangeRole("admin", "member")).toBe(false);
  });
});

describe("invite helpers", () => {
  it("builds a join URL without double slashes", () => {
    expect(inviteUrl("https://x.com/", "abc")).toBe("https://x.com/app/join/abc");
  });
  it("generates long dash-free tokens", () => {
    const t = newInviteToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(newInviteToken()).not.toBe(t);
  });
});

describe("team member names", () => {
  it("maps the restricted RPC names without including private profile fields", () => {
    const row = { id: "member-1", display_name: "Kale", stripe_customer_id: "private" };
    expect(teamNames([row])).toEqual({ "member-1": "Kale" });
  });
  it("preserves the teammate fallback for missing names", () => {
    expect(teamNames([{ id: "member-2", display_name: null }])).toEqual({ "member-2": "" });
  });
  it("handles a team with no name rows", () => {
    expect(teamNames([])).toEqual({});
  });
});

describe("seats", () => {
  const members = [
    { user_id: "c", role: "member", created_at: "2026-10-03T00:00:00Z" },
    { user_id: "o", role: "owner", created_at: "2026-10-05T00:00:00Z" },
    { user_id: "a", role: "admin", created_at: "2026-10-01T00:00:00Z" },
    { user_id: "b", role: "member", created_at: "2026-10-02T00:00:00Z" },
  ];
  it("orders the owner first, then by join date", () => {
    expect(seatOrder(members).map((m) => m.user_id)).toEqual(["o", "a", "b", "c"]);
  });
  it("drops the newest members first when seats are reduced", () => {
    expect(uncoveredMembers(members, 4)).toEqual([]);
    expect(uncoveredMembers(members, 3).map((m) => m.user_id)).toEqual(["c"]);
  });
  it("leaves everyone uncovered under the 3-seat minimum", () => {
    expect(uncoveredMembers(members, 0)).toHaveLength(4);
  });
});

describe("inviteProblemMessage", () => {
  it("says clearly when the team is full", () => {
    expect(inviteProblemMessage("seats_full", "Acme Realty")).toBe(
      "Acme Realty has no free seats right now. Ask the team owner to add a seat (Settings → Manage billing), then open this link again.",
    );
  });
  it("covers every refusal reason", () => {
    expect(inviteProblemMessage("used")).toContain("already used");
    expect(inviteProblemMessage("expired")).toContain("expired");
    expect(inviteProblemMessage("other_team")).toContain("already on another team");
    expect(inviteProblemMessage("invalid")).toContain("not valid");
    expect(inviteProblemMessage("seats_full", null)).toMatch(/^This team has no free seats/);
  });
});
