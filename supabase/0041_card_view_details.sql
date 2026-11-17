-- 0041: richer card analytics.
--
-- Views, saves and link taps now go through the app's server, which adds the
-- visitor's approximate location (city, region, country, read from Cloudflare;
-- the IP address itself is never stored), how they found the card (QR code,
-- NFC tag, email signature, shared link) and their operating system, and
-- which skips the card owner's own visits.
--
-- Owner's own visits: every browser where the owner has opened the app is
-- remembered as theirs (card_owner_visitors, by the anonymous per-browser id
-- the card page already uses). Views from those browsers aren't logged, and
-- the stats leave out any already logged, so past numbers correct too.
--
-- Additive: five nullable columns, one small table, a service-role-only
-- logging function, a claim function for the app, and the two stats
-- functions gain the owner filter (premium_card_insights also returns three
-- more breakdowns). The old log_card_event stays for pages already open.

alter table public.card_views
  add column if not exists via text,
  add column if not exists os text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists country text;

alter table public.card_views
  drop constraint if exists card_views_via_check,
  add constraint card_views_via_check check (via is null or via in ('qr', 'nfc', 'email', 'link')),
  drop constraint if exists card_views_os_check,
  add constraint card_views_os_check
    check (os is null or os in ('iphone', 'ipad', 'android', 'mac', 'windows', 'linux', 'other')),
  drop constraint if exists card_views_place_check,
  add constraint card_views_place_check
    check (
      (city is null or length(city) <= 80)
      and (region is null or length(region) <= 80)
      and (country is null or country ~ '^[A-Z]{2}$')
    );

create table if not exists public.card_owner_visitors (
  user_id uuid not null references auth.users(id) on delete cascade,
  visitor text not null check (length(visitor) between 8 and 64),
  created_at timestamptz not null default now(),
  primary key (user_id, visitor)
);
alter table public.card_owner_visitors enable row level security;
revoke all on public.card_owner_visitors from anon, authenticated;

-- The app calls this on load: "this browser is mine". At most 50 per person.
create or replace function public.claim_owner_visitor(_visitor text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or _visitor is null or length(_visitor) not between 8 and 64 then return; end if;
  if (select count(*) from public.card_owner_visitors where user_id = uid) >= 50 then return; end if;
  insert into public.card_owner_visitors (user_id, visitor) values (uid, _visitor)
    on conflict do nothing;
end $$;

revoke all on function public.claim_owner_visitor(text) from public, anon;
grant execute on function public.claim_owner_visitor(text) to authenticated;

-- Same rules and limits as log_card_event, plus the new details. Only the
-- app's server calls it (it alone knows the location and who is signed in),
-- forwarding the visitor's IP for the per-IP limit exactly like share-backs.
create or replace function public.log_card_view(
  _slug text,
  _event text,
  _meta text default null,
  _referrer text default null,
  _device text default null,
  _visitor text default null,
  _via text default null,
  _os text default null,
  _city text default null,
  _region text default null,
  _country text default null,
  _viewer uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c record; recent integer; ip text;
begin
  if _event not in ('view', 'save', 'click') then raise exception 'invalid event'; end if;
  select id, user_id into c from public.cards where slug = lower(_slug);
  if c.id is null then return; end if;
  -- The owner looking at their own card isn't a visitor.
  if _viewer is not null and _viewer = c.user_id then return; end if;
  if _visitor is not null and exists (
    select 1 from public.card_owner_visitors o where o.user_id = c.user_id and o.visitor = _visitor
  ) then return; end if;
  ip := public.rpc_client_ip_hash();
  if ip is not null then
    perform pg_advisory_xact_lock(hashtextextended('events:' || ip, 0));
    select count(*) into recent from public.rpc_rate_limits
      where ip_hash = ip and kind = 'event' and created_at > now() - interval '1 hour';
    if recent >= 120 then return; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('event-card:' || c.id::text, 0));
  select count(*) into recent from public.card_views
    where card_id = c.id and created_at > now() - interval '1 hour';
  if recent >= 2000 then return; end if;
  if ip is not null then
    insert into public.rpc_rate_limits(ip_hash, kind, card_id) values (ip, 'event', c.id);
  end if;
  insert into public.card_views
    (card_id, user_id, event_type, meta, referrer, device, visitor, via, os, city, region, country)
  values (
    c.id, c.user_id, _event,
    nullif(left(coalesce(_meta, ''), 80), ''),
    nullif(left(coalesce(_referrer, ''), 120), ''),
    nullif(left(coalesce(_device, ''), 20), ''),
    nullif(left(coalesce(_visitor, ''), 64), ''),
    case when _via in ('qr', 'nfc', 'email', 'link') then _via end,
    case when _os in ('iphone', 'ipad', 'android', 'mac', 'windows', 'linux', 'other') then _os end,
    nullif(left(trim(coalesce(_city, '')), 80), ''),
    nullif(left(trim(coalesce(_region, '')), 80), ''),
    case when upper(_country) ~ '^[A-Z]{2}$' and upper(_country) <> 'XX' then upper(_country) end
  );
end $$;

revoke all on function public.log_card_view(text, text, text, text, text, text, text, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.log_card_view(text, text, text, text, text, text, text, text, text, text, text, uuid)
  to service_role;

-- Premium breakdowns, now with how people found the card, where they were,
-- and what they were on. Same plan check as before.
create or replace function public.premium_card_insights(p_since timestamptz, p_card uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or public.effective_plan(uid) <> 'premium' then
    raise exception 'Advanced analytics is a Premium feature' using errcode = '42501';
  end if;
  return (
    with v as (
      select event_type, meta, referrer, device, visitor, via, os, city, region, country
      from public.card_views
      where user_id = uid and created_at >= p_since and (p_card is null or card_id = p_card)
        and (visitor is null or visitor not in
             (select o.visitor from public.card_owner_visitors o where o.user_id = uid))
    ),
    views as (select * from v where event_type = 'view')
    select jsonb_build_object(
      'unique', (select count(distinct visitor) from views),
      'devices', coalesce((select jsonb_agg(jsonb_build_array(device, n) order by n desc)
        from (select device, count(*) n from views where device is not null group by device) d),
        '[]'::jsonb),
      'referrers', coalesce((select jsonb_agg(jsonb_build_array(referrer, n) order by n desc)
        from (select referrer, count(*) n from views where referrer is not null
              group by referrer order by n desc limit 6) r), '[]'::jsonb),
      'clicks', coalesce((select jsonb_agg(jsonb_build_array(label, n) order by n desc)
        from (select coalesce(nullif(meta, ''), 'link') label, count(*) n from v
              where event_type = 'click' group by 1 order by n desc limit 8) c), '[]'::jsonb),
      -- How they found the card: the tagged link, else a website, else direct.
      'sources', coalesce((select jsonb_agg(jsonb_build_array(src, n) order by n desc)
        from (select coalesce(via, case when referrer is not null then 'web' else 'direct' end) src,
                     count(*) n
              from views group by 1) s), '[]'::jsonb),
      -- "Jacksonville, FL" in the US, "London, GB" elsewhere; city-level only.
      'places', coalesce((select jsonb_agg(jsonb_build_array(place, n) order by n desc)
        from (select case
                       when city is not null and country = 'US' and region is not null
                         then city || ', ' || region
                       when city is not null and country is not null then city || ', ' || country
                       else coalesce(city, country)
                     end place,
                     count(*) n
              from views where city is not null or country is not null
              group by 1 order by n desc limit 8) p), '[]'::jsonb),
      'systems', coalesce((select jsonb_agg(jsonb_build_array(os, n) order by n desc)
        from (select os, count(*) n from views where os is not null group by os) o), '[]'::jsonb)
    )
  );
end $$;

-- The chart and totals, leaving out the owner's own browsers.
create or replace function public.card_event_series(p_since timestamptz, p_card uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select event_type, (created_at at time zone 'utc')::date as day from public.card_views
    where user_id = auth.uid() and created_at >= p_since and (p_card is null or card_id = p_card)
      and (visitor is null or visitor not in
           (select o.visitor from public.card_owner_visitors o where o.user_id = auth.uid()))
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'view', (select count(*) from v where event_type = 'view'),
      'save', (select count(*) from v where event_type = 'save'),
      'shareback', (select count(*) from v where event_type = 'shareback'),
      'click', (select count(*) from v where event_type = 'click')),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'view', view, 'save', save, 'shareback', shareback) order by day)
      from (select day,
              count(*) filter (where event_type = 'view') as view,
              count(*) filter (where event_type = 'save') as save,
              count(*) filter (where event_type = 'shareback') as shareback
            from v group by day) d), '[]'::jsonb))
$$;
