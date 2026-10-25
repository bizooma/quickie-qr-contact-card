-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Reliability and safety fixes from the October 2026 audit.
-- 1. Deleting a login removes everything it owned (cards stayed public before).
-- 2. Stripe webhook events are recorded so a retry can't apply twice.
-- 3. A card's owner must belong to the team the card is attached to, and
--    a card can't be handed to another user.
-- 4. Missing indexes on hot paths, and a cleanup for tables that grew forever.

-- ---- 1. Cascade from auth.users --------------------------------------------
-- One contact was already orphaned by an earlier admin deletion.
delete from public.contacts c where not exists (select 1 from auth.users u where u.id = c.user_id);
delete from public.cards c where not exists (select 1 from auth.users u where u.id = c.user_id);
delete from public.card_links c where not exists (select 1 from auth.users u where u.id = c.user_id);
delete from public.card_views c where not exists (select 1 from auth.users u where u.id = c.user_id);
delete from public.contact_notes c where not exists (select 1 from auth.users u where u.id = c.user_id);
delete from public.contact_tags c where not exists (select 1 from auth.users u where u.id = c.user_id);

alter table public.cards add constraint cards_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.contacts add constraint contacts_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.card_links add constraint card_links_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.card_views add constraint card_views_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.contact_notes add constraint contact_notes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.contact_tags add constraint contact_tags_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ---- 2. Stripe webhook idempotency -------------------------------------------
create table public.stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from public, anon, authenticated;
-- Service role only: the webhook inserts; a duplicate id means "already handled".

-- ---- 3. Card ownership ----------------------------------------------------------
-- The "own cards all" policy lets a user set any org_id, and the card limit
-- trigger skips team cards, so a free user could attach cards to a team they
-- know the id of. Team admins could also move a card to any user.
create or replace function public.enforce_card_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'A card cannot be moved to another user' using errcode = '42501';
  end if;
  if new.org_id is not null and not exists (
    select 1 from public.org_members m where m.org_id = new.org_id and m.user_id = new.user_id
  ) then
    raise exception 'The card owner must be a member of that team' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_card_ownership() from public, anon, authenticated;
create trigger cards_ownership before insert or update of user_id, org_id on public.cards
  for each row execute function public.enforce_card_ownership();

-- ---- 4. Indexes and cleanup -------------------------------------------------------
create index if not exists contacts_card_idx on public.contacts (card_id) where card_id is not null;
create index if not exists cards_org_idx on public.cards (org_id) where org_id is not null;
create index if not exists contact_reminders_contact_idx on public.contact_reminders (contact_id);
create index if not exists profiles_stripe_sub_idx on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;
create index if not exists ai_usage_user_kind_time_idx on public.ai_usage (user_id, kind, created_at);
create index if not exists purchase_entitlements_email_kind_idx on public.purchase_entitlements (email, kind);
create index if not exists card_views_user_time_idx on public.card_views (user_id, created_at);

-- Called by the reminders cron (every 15 minutes) alongside cleanup_rpc_rate_limits.
-- Analytics show at most 90 days; keep a year of card views for the admin trend.
create or replace function public.cleanup_stale_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v bigint; s bigint; p bigint; e bigint;
begin
  delete from public.card_views where created_at < now() - interval '400 days';
  get diagnostics v = row_count;
  delete from public.site_events where created_at < now() - interval '180 days';
  get diagnostics s = row_count;
  delete from public.push_messages where created_at < now() - interval '7 days';
  get diagnostics p = row_count;
  delete from public.stripe_events where created_at < now() - interval '90 days';
  get diagnostics e = row_count;
  return jsonb_build_object('card_views', v, 'site_events', s, 'push_messages', p, 'stripe_events', e);
end $$;
revoke execute on function public.cleanup_stale_data() from public, anon, authenticated;
grant execute on function public.cleanup_stale_data() to service_role;
