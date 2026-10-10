-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Phase 2: teams (orgs, members, invites, brand control, shared contacts) + platform admin.

-- ── Tables ────────────────────────────────────────────────────────────────────

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) >= 2 and length(name) <= 60),
  owner_id uuid not null references auth.users(id) on delete cascade,
  accent_color text,
  background_color text,
  logo_path text,
  lock_brand boolean not null default false,
  share_contacts boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id),
  unique (user_id) -- one team per user keeps roles and billing unambiguous
);

create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  token text not null unique,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid,
  accepted_at timestamptz
);

alter table public.cards add column org_id uuid references public.orgs(id) on delete set null;
alter table public.profiles add column is_admin boolean not null default false;

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invites enable row level security;

-- ── SECURITY DEFINER helpers (avoid RLS recursion between orgs/org_members) ──

create or replace function public.org_role_of(_org uuid)
returns text language sql stable security definer set search_path = public
as $$ select role from public.org_members where org_id = _org and user_id = auth.uid() $$;

create or replace function public.in_same_org_as(_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.org_members a join public.org_members b using (org_id)
                  where a.user_id = auth.uid() and b.user_id = _user) $$;

create or replace function public.org_shares_contacts_of(_owner uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.org_members a
                  join public.org_members b using (org_id)
                  join public.orgs o on o.id = a.org_id
                  where a.user_id = auth.uid() and b.user_id = _owner and o.share_contacts) $$;

grant execute on function public.org_role_of(uuid), public.in_same_org_as(uuid),
  public.org_shares_contacts_of(uuid) to authenticated, service_role;

-- ── Policies ──────────────────────────────────────────────────────────────────

-- The owner_id branch matters: right after `insert into orgs` the owner has no
-- org_members row yet, and without it the bootstrap membership insert below
-- can't see the org and fails its RLS check.
create policy "org member select" on public.orgs for select
  using (owner_id = auth.uid() or public.org_role_of(id) is not null);
create policy "org create" on public.orgs for insert with check (owner_id = auth.uid());
create policy "org manage" on public.orgs for update
  using (public.org_role_of(id) in ('owner', 'admin'));
create policy "org delete" on public.orgs for delete using (owner_id = auth.uid());

create policy "members select" on public.org_members for select
  using (public.org_role_of(org_id) is not null);
-- Admins add members (invite acceptance runs via service role); the second
-- branch lets a fresh org's owner insert their own owner row.
create policy "members insert" on public.org_members for insert
  with check (
    public.org_role_of(org_id) in ('owner', 'admin')
    or (user_id = auth.uid() and role = 'owner'
        and exists (select 1 from public.orgs o where o.id = org_id and o.owner_id = auth.uid()))
  );
create policy "members delete" on public.org_members for delete
  using (user_id = auth.uid() or (public.org_role_of(org_id) in ('owner', 'admin') and role <> 'owner'));
create policy "members role update" on public.org_members for update
  using (public.org_role_of(org_id) = 'owner' and role <> 'owner')
  with check (role <> 'owner');

create policy "invites manage" on public.org_invites for all
  using (public.org_role_of(org_id) in ('owner', 'admin'))
  with check (public.org_role_of(org_id) in ('owner', 'admin'));

-- Team visibility on existing tables
create policy "org cards select" on public.cards for select
  using (org_id is not null and public.org_role_of(org_id) is not null);
create policy "org cards admin write" on public.cards for insert
  with check (
    org_id is not null and public.org_role_of(org_id) in ('owner', 'admin')
    and exists (select 1 from public.org_members m where m.org_id = cards.org_id and m.user_id = cards.user_id)
  );
create policy "org cards admin update" on public.cards for update
  using (org_id is not null and public.org_role_of(org_id) in ('owner', 'admin'));
create policy "org views select" on public.card_views for select
  using (exists (select 1 from public.cards c
                 where c.id = card_views.card_id and c.org_id is not null
                   and public.org_role_of(c.org_id) in ('owner', 'admin')));
create policy "teammate profile select" on public.profiles for select
  using (public.in_same_org_as(id));
create policy "org shared contacts select" on public.contacts for select
  using (public.org_shares_contacts_of(user_id));

-- ── Triggers ──────────────────────────────────────────────────────────────────

-- Brand lock: org colors/logo override whatever a team card is saved with
create or replace function public.apply_org_brand()
returns trigger language plpgsql security definer set search_path = public
as $$
declare o record;
begin
  if new.org_id is null then return new; end if;
  select lock_brand, accent_color, background_color, logo_path into o from public.orgs where id = new.org_id;
  if o.lock_brand then
    if o.accent_color is not null then new.accent_color := o.accent_color; end if;
    if o.background_color is not null then new.background_color := o.background_color; end if;
    if o.logo_path is not null then new.logo_path := o.logo_path; end if;
  end if;
  return new;
end $$;

create trigger cards_org_brand before insert or update on public.cards
  for each row execute function public.apply_org_brand();

-- Team cards don't count against the member's personal card limit
create or replace function public.enforce_card_limit()
returns trigger language plpgsql security definer set search_path = public
as $$
declare p text; n int; lim int;
begin
  if new.org_id is not null then return new; end if;
  select plan into p from public.profiles where id = new.user_id;
  lim := case when p = 'pro' then 50 else 1 end;
  select count(*) into n from public.cards where user_id = new.user_id and org_id is null;
  if n >= lim then
    raise exception 'Card limit reached — upgrade to Pro to create more cards';
  end if;
  return new;
end $$;

create or replace function public.enforce_org_plan()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (select plan from public.profiles where id = new.owner_id) is distinct from 'pro' then
    raise exception 'Creating a team requires a Pro plan';
  end if;
  return new;
end $$;

create trigger orgs_plan before insert on public.orgs
  for each row execute function public.enforce_org_plan();

-- ── Platform admin ────────────────────────────────────────────────────────────

-- Single-call dashboard aggregate; service_role only — the app calls it from a
-- server function that first re-checks profiles.is_admin.
create or replace function public.admin_overview()
returns jsonb language sql stable security definer set search_path = public
as $$
select jsonb_build_object(
  'users', (select count(*) from auth.users),
  'cards', (select count(*) from public.cards),
  'contacts', (select count(*) from public.contacts),
  'orgs', (select count(*) from public.orgs),
  'plans', coalesce((select jsonb_object_agg(plan, n) from (select plan, count(*) n from public.profiles group by plan) q), '{}'::jsonb),
  'events30', coalesce((select jsonb_object_agg(event_type, n) from (select event_type, count(*) n from public.card_views where created_at > now() - interval '30 days' group by 1) q), '{}'::jsonb),
  'ai_month', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.ai_usage where created_at >= date_trunc('month', now()) group by 1) q), '{}'::jsonb),
  'user_rows', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select u.id, u.email, p.display_name, p.plan, p.is_admin, u.created_at,
        (select count(*) from public.cards c where c.user_id = u.id) as cards,
        (select count(*) from public.contacts ct where ct.user_id = u.id) as contacts,
        (select count(*) from public.ai_usage a where a.user_id = u.id and a.created_at >= date_trunc('month', now())) as ai_month
      from auth.users u left join public.profiles p on p.id = u.id
      order by u.created_at desc limit 50) r), '[]'::jsonb)
) $$;

revoke execute on function public.admin_overview() from public, anon, authenticated;
grant execute on function public.admin_overview() to service_role;
