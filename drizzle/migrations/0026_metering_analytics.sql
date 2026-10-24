-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- 1. AI usage is reserved atomically BEFORE the AI call, so parallel requests
--    can't all slip past the cap and starter credits can't be charged twice.
-- 2. Analytics totals are computed in the database (the API caps responses at
--    1,000 rows, so browser-side sums were silently low).
-- 3. Win-back push candidates.

-- ---- 1. Reservations ---------------------------------------------------------
alter table public.ai_usage
  add column reservation uuid,
  add column credit boolean not null default false;
create index ai_usage_reservation_idx on public.ai_usage (reservation) where reservation is not null;

-- Locks the profile, checks the plan's monthly allowance (passed in by the
-- caller from plans.ts; null = no cap) plus never-expiring starter credits,
-- and inserts the usage rows up front. Units past the allowance consume
-- starter credits right here. A per-user rate limit guards uncapped kinds.
-- Returns {ok, reservation, used_before, from_credits} or {ok:false, code,
-- available}.
create or replace function public.reserve_ai_usage(_user uuid, _kind text, _units int, _limit int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  used int; recent int; available int; credits int := 0; from_credits int := 0;
  res uuid := gen_random_uuid(); i int;
begin
  if _units < 1 then return jsonb_build_object('ok', false, 'code', 'bad_units'); end if;
  select * into p from public.profiles where id = _user for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'no_profile'); end if;

  -- Rate limit: at most 40 AI actions in 10 minutes, whatever the plan.
  select count(distinct coalesce(reservation::text, id::text)) into recent from public.ai_usage
    where user_id = _user and kind <> 'self_scan' and created_at > now() - interval '10 minutes';
  if recent >= 40 then return jsonb_build_object('ok', false, 'code', 'rate'); end if;

  select count(*) into used from public.ai_usage
    where user_id = _user and kind = _kind and created_at >= month_start;

  if _limit is null then
    available := _units;
  else
    available := greatest(_limit - used, 0);
    if _kind = 'scan' then credits := p.credit_scan;
    elsif _kind = 'follow_up' then credits := p.credit_follow_up;
    end if;
    if available + credits < _units then
      return jsonb_build_object('ok', false, 'code', 'cap', 'available', available + credits,
        'used', used);
    end if;
    from_credits := greatest(_units - available, 0);
    if from_credits > 0 then
      if _kind = 'scan' then
        update public.profiles set credit_scan = credit_scan - from_credits where id = _user;
      else
        update public.profiles set credit_follow_up = credit_follow_up - from_credits where id = _user;
      end if;
    end if;
  end if;

  for i in 1.._units loop
    insert into public.ai_usage (user_id, kind, reservation, credit)
      values (_user, _kind, res, i > _units - from_credits);
  end loop;
  return jsonb_build_object('ok', true, 'reservation', res, 'used_before', used,
    'from_credits', from_credits);
end $$;

-- After the AI call: keep `_actual` units of the reservation (0 = the call
-- failed, release everything). Rows paid by starter credits are released
-- first and their credits restored. More units than reserved (a photo held
-- more cards than photos) are added without further checks.
create or replace function public.settle_ai_usage(_reservation uuid, _actual int)
returns void language plpgsql security definer set search_path = public as $$
declare r record; reserved int; extra int; refund int;
begin
  select user_id, kind, count(*) as n into r from public.ai_usage
    where reservation = _reservation group by user_id, kind;
  if not found then return; end if;
  reserved := r.n;
  if _actual < reserved then
    with victims as (
      select id, credit from public.ai_usage where reservation = _reservation
      order by credit desc, created_at desc limit reserved - _actual
    ), gone as (
      delete from public.ai_usage u using victims v where u.id = v.id returning v.credit
    )
    select count(*) filter (where credit) into refund from gone;
    if coalesce(refund, 0) > 0 then
      if r.kind = 'scan' then
        update public.profiles set credit_scan = credit_scan + refund where id = r.user_id;
      elsif r.kind = 'follow_up' then
        update public.profiles set credit_follow_up = credit_follow_up + refund where id = r.user_id;
      end if;
    end if;
  elsif _actual > reserved then
    extra := _actual - reserved;
    insert into public.ai_usage (user_id, kind, reservation)
      select r.user_id, r.kind, _reservation from generate_series(1, extra);
  end if;
end $$;

revoke execute on function public.reserve_ai_usage(uuid, text, int, int) from public, anon, authenticated;
revoke execute on function public.settle_ai_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, text, int, int) to service_role;
grant execute on function public.settle_ai_usage(uuid, int) to service_role;

-- ---- 2. Analytics in the database ---------------------------------------------
-- Totals and a per-day series for the signed-in user's cards. No 1,000-row cap.
create or replace function public.card_event_series(p_since timestamptz, p_card uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with v as (
    select event_type, (created_at at time zone 'utc')::date as day from public.card_views
    where user_id = auth.uid() and created_at >= p_since and (p_card is null or card_id = p_card)
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'view', (select count(*) from v where event_type = 'view'),
      'save', (select count(*) from v where event_type = 'save'),
      'shareback', (select count(*) from v where event_type = 'shareback'),
      'click', (select count(*) from v where event_type = 'click')),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'view', view, 'save', save,
        'shareback', shareback) order by day)
      from (select day,
              count(*) filter (where event_type = 'view') as view,
              count(*) filter (where event_type = 'save') as save,
              count(*) filter (where event_type = 'shareback') as shareback
            from v group by day) d), '[]'::jsonb))
$$;
revoke execute on function public.card_event_series(timestamptz, uuid) from public, anon;
grant execute on function public.card_event_series(timestamptz, uuid) to authenticated;

-- Team totals for the org page (owner/admin only), plus views per card.
create or replace function public.org_event_totals(p_org uuid, p_since timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if public.org_role_of(p_org) not in ('owner', 'admin') then
    raise exception 'Not a team admin' using errcode = '42501';
  end if;
  return (
    with v as (
      select e.card_id, e.event_type from public.card_views e
      join public.cards c on c.id = e.card_id
      where c.org_id = p_org and e.created_at >= p_since
    )
    select jsonb_build_object(
      'view', (select count(*) from v where event_type = 'view'),
      'save', (select count(*) from v where event_type = 'save'),
      'shareback', (select count(*) from v where event_type = 'shareback'),
      'by_card', coalesce((select jsonb_object_agg(card_id, n)
        from (select card_id, count(*) n from v where event_type = 'view' group by card_id) b),
        '{}'::jsonb)));
end $$;
revoke execute on function public.org_event_totals(uuid, timestamptz) from public, anon;
grant execute on function public.org_event_totals(uuid, timestamptz) to authenticated;

-- ---- 3. Win-back ----------------------------------------------------------------
alter table public.profiles add column winback_sent_at timestamptz;
-- People with a push subscription whose last activity was over 14 days ago,
-- not yet nudged. The cron sends one push each and stamps winback_sent_at.
create or replace function public.winback_candidates(p_limit int default 50)
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
  where p.winback_sent_at is null
    and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
    and coalesce(p.last_seen_at, p.created_at) < now() - interval '14 days'
  limit p_limit
$$;
revoke execute on function public.winback_candidates(int) from public, anon, authenticated;
grant execute on function public.winback_candidates(int) to service_role;

-- ---- 4. Scan top-up pack ---------------------------------------------------------
-- Called by the Stripe webhook when a one-off top-up checkout is paid
-- (plans.ts TOPUP_SCANS / TOPUP_FOLLOW_UPS). Credits never expire.
create or replace function public.add_topup_credits(_user uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles set credit_scan = credit_scan + 50, credit_follow_up = credit_follow_up + 50
  where id = _user
$$;
revoke execute on function public.add_topup_credits(uuid) from public, anon, authenticated;
grant execute on function public.add_topup_credits(uuid) to service_role;
