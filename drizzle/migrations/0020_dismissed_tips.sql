-- In-app feature tips the user chose "Don't show this again" for (applied
-- live on 2026-10-12; this file is the record). Stored on the profile so
-- the choice follows the user across devices. Owners update it under the
-- existing profile update policy; the column grant extends 0002's list.

alter table public.profiles
  add column if not exists dismissed_tips text[] not null default '{}'
  check (cardinality(dismissed_tips) <= 50);

grant update (dismissed_tips) on public.profiles to authenticated;
