-- Admin suite (applied live on 2026-10-12; this file is the record):
-- suspension, presence tracking, richer admin_overview, admin_analytics.

alter table public.profiles
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists last_seen_at timestamptz;

-- Which screens a signed-in user opened, for the admin dashboard.
-- Service-role only (no policies, no grants); written by trackActivity.
create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);
alter table public.user_activity enable row level security;
create index if not exists user_activity_user_idx on public.user_activity (user_id, created_at desc);
create index if not exists user_activity_created_idx on public.user_activity (created_at);
revoke all on public.user_activity from anon, authenticated;

-- Suspended accounts keep read access (so the app can show the suspension
-- notice) but every direct write is refused at the database. Service-role
-- and system paths carry no auth.uid() and pass through.
create or replace function public.block_suspended_writes()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is not null
     and exists (select 1 from public.profiles where id = auth.uid() and suspended) then
    raise exception 'Account suspended — contact support@contactkickstart.com';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['cards','card_links','contacts','contact_notes','contact_tags','orgs','org_members','org_invites','push_subscriptions','profiles']
  loop
    execute format('drop trigger if exists block_suspended_%I on public.%I', t, t);
    execute format('create trigger block_suspended_%I before insert or update or delete on public.%I for each row execute function public.block_suspended_writes()', t, t);
  end loop;
end $$;

-- admin_overview: user rows gain suspended + last_seen_at (limit raised to
-- 200), and org_rows lists every team with owner, seats and member count.
create or replace function public.admin_overview()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
select jsonb_build_object(
  'users', (select count(*) from auth.users),
  'cards', (select count(*) from public.cards),
  'contacts', (select count(*) from public.contacts),
  'orgs', (select count(*) from public.orgs),
  'plans', coalesce((select jsonb_object_agg(plan, n) from (select plan, count(*) n from public.profiles group by plan) q), '{}'::jsonb),
  'events30', coalesce((select jsonb_object_agg(event_type, n) from (select event_type, count(*) n from public.card_views where created_at > now() - interval '30 days' group by 1) q), '{}'::jsonb),
  'ai_month', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.ai_usage where created_at >= date_trunc('month', now()) group by 1) q), '{}'::jsonb),
  'user_rows', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select u.id, u.email, p.display_name, p.plan, p.is_admin, p.suspended, p.last_seen_at, u.created_at,
        (select count(*) from public.cards c where c.user_id = u.id) as cards,
        (select count(*) from public.contacts ct where ct.user_id = u.id) as contacts,
        (select count(*) from public.ai_usage a where a.user_id = u.id and a.created_at >= date_trunc('month', now())) as ai_month
      from auth.users u left join public.profiles p on p.id = u.id
      order by u.created_at desc limit 200) r), '[]'::jsonb),
  'org_rows', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select o.id, o.name, o.created_at, u.email as owner_email, p.team_seats as seats, p.suspended as owner_suspended,
        (select count(*) from public.org_members m where m.org_id = o.id) as members
      from public.orgs o
      join auth.users u on u.id = o.owner_id
      left join public.profiles p on p.id = o.owner_id
      order by o.created_at desc limit 100) r), '[]'::jsonb)
) $function$;

-- 30-day daily series + top cards + landing events for the analytics tab.
create or replace function public.admin_analytics()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
with days as (select generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day')::date d)
select jsonb_build_object(
  'signups', (select jsonb_agg(jsonb_build_object('d', d, 'n', coalesce(n,0)) order by d) from days
    left join (select created_at::date cd, count(*) n from auth.users where created_at > now() - interval '30 days' group by 1) s on s.cd = days.d),
  'active_users', (select jsonb_agg(jsonb_build_object('d', d, 'n', coalesce(n,0)) order by d) from days
    left join (select created_at::date cd, count(distinct user_id) n from public.user_activity where created_at > now() - interval '30 days' group by 1) s on s.cd = days.d),
  'card_views', (select jsonb_agg(jsonb_build_object('d', d, 'n', coalesce(n,0)) order by d) from days
    left join (select created_at::date cd, count(*) n from public.card_views where event_type = 'view' and created_at > now() - interval '30 days' group by 1) s on s.cd = days.d),
  'sharebacks', (select jsonb_agg(jsonb_build_object('d', d, 'n', coalesce(n,0)) order by d) from days
    left join (select created_at::date cd, count(*) n from public.card_views where event_type = 'shareback' and created_at > now() - interval '30 days' group by 1) s on s.cd = days.d),
  'ai_calls', (select jsonb_agg(jsonb_build_object('d', d, 'n', coalesce(n,0)) order by d) from days
    left join (select created_at::date cd, count(*) n from public.ai_usage where created_at > now() - interval '30 days' group by 1) s on s.cd = days.d),
  'top_cards', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select c.slug, c.label, u.email as owner_email, count(*) as views
      from public.card_views v join public.cards c on c.id = v.card_id join auth.users u on u.id = c.user_id
      where v.created_at > now() - interval '30 days' and v.event_type = 'view'
      group by c.slug, c.label, u.email order by views desc limit 10) r), '[]'::jsonb),
  'site_events30', coalesce((select jsonb_object_agg(event_type, n) from (
      select event_type, count(*) n from public.site_events where created_at > now() - interval '30 days' group by 1) q), '{}'::jsonb)
) $function$;

revoke execute on function public.admin_analytics() from anon, authenticated;
