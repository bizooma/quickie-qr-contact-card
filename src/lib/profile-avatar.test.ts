import { describe, expect, it } from "vitest";
import { AVATAR_NONE, avatarSource, isUploadedAvatar } from "./profile-avatar";

describe("avatarSource", () => {
  const cards = [null, "u1/card-b.jpg", "u1/card-c.jpg"];
  it("uses the person's choice first", () => {
    expect(avatarSource("u1/avatars/a.jpg", cards)).toEqual({
      kind: "path",
      path: "u1/avatars/a.jpg",
    });
    expect(avatarSource("https://lh3.googleusercontent.com/x", cards)).toEqual({
      kind: "url",
      url: "https://lh3.googleusercontent.com/x",
    });
    expect(avatarSource(AVATAR_NONE, cards)).toEqual({ kind: "none" });
  });
  it("falls back to the first card photo, then initials", () => {
    expect(avatarSource(null, cards)).toEqual({ kind: "path", path: "u1/card-b.jpg" });
    expect(avatarSource("", [])).toEqual({ kind: "none" });
  });
  it("never loads a plain-http URL", () => {
    expect(avatarSource("http://example.com/a.jpg", [])).toEqual({
      kind: "path",
      path: "http://example.com/a.jpg",
    });
  });
  it("recognizes uploaded avatars", () => {
    expect(isUploadedAvatar("u1/avatars/a.jpg")).toBe(true);
    expect(isUploadedAvatar("u1/card-b.jpg")).toBe(false);
    expect(isUploadedAvatar(null)).toBe(false);
  });
});
