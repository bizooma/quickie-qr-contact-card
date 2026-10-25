// Which picture the profile avatar shows. profiles.avatar_url holds the
// person's choice: an uploaded photo or one of their card photos (a storage
// path in the private card-media bucket), a photo URL from their sign-in
// provider, or AVATAR_NONE for initials. Empty means automatic: the photo on
// their oldest card that has one.

export const AVATAR_NONE = "none";

export type AvatarSource =
  { kind: "url"; url: string } | { kind: "path"; path: string } | { kind: "none" };

export function avatarSource(
  avatarUrl: string | null | undefined,
  cardHeadshots: (string | null | undefined)[],
): AvatarSource {
  const v = avatarUrl?.trim();
  if (v === AVATAR_NONE) return { kind: "none" };
  if (v && /^https:\/\//i.test(v)) return { kind: "url", url: v };
  if (v) return { kind: "path", path: v };
  const first = cardHeadshots.find((p) => !!p);
  return first ? { kind: "path", path: first } : { kind: "none" };
}

/** Uploaded avatars live in their own folder, so replacing one can delete
 *  the old file without touching a photo a card still uses. */
export function isUploadedAvatar(value: string | null | undefined): value is string {
  return !!value && value.includes("/avatars/");
}
