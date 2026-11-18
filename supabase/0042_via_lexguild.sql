-- 0042: "LexGuild profile" as a way people find a card.
--
-- LexGuild member profiles link to the member's QuickieQR card with
-- ?via=lexguild, so Analytics can show "LexGuild profile" next to QR scans
-- and shared links. Widens the check constraint and log_card_view's tag
-- filter (the function is otherwise unchanged; grants carry over).

alter table public.card_views
  drop constraint if exists card_views_via_check,
  add constraint card_views_via_check
    check (via is null or via in ('qr', 'nfc', 'email', 'link', 'lexguild'));

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
    case when _via in ('qr', 'nfc', 'email', 'link', 'lexguild') then _via end,
    case when _os in ('iphone', 'ipad', 'android', 'mac', 'windows', 'linux', 'other') then _os end,
    nullif(left(trim(coalesce(_city, '')), 80), ''),
    nullif(left(trim(coalesce(_region, '')), 80), ''),
    case when upper(_country) ~ '^[A-Z]{2}$' and upper(_country) <> 'XX' then upper(_country) end
  );
end $$;

