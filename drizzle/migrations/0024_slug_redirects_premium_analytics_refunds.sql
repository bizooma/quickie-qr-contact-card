-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- 1. Old card links keep working after a rename (printed QR codes).
-- 2. Premium analytics checked on the server.
-- 3. Pinball refunds take back what the purchase gave.

-- ---- 1. Card address history ------------------------------------------------
-- Every address a card used to have keeps forwarding to it (the last 5 per
-- card), and nobody else can claim one while it does. Deleting the card
-- frees them.

create table public.card_slug_history (
  old_slug text primary key,
  card_id uuid not null references public.cards(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index card_slug_history_card_idx on public.card_slug_history (card_id, created_at);
alter table public.card_slug_history enable row level security;
-- No policies or grants on purpose: only the SECURITY DEFINER functions below touch it.
revoke all on public.card_slug_history from public, anon, authenticated;

create or replace function public.remember_old_slug()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.slug is distinct from old.slug then
    insert into public.card_slug_history (old_slug, card_id) values (old.slug, new.id)
      on conflict (old_slug) do update set card_id = excluded.card_id, created_at = now();
    -- Taking an old address back makes it the live one again.
    delete from public.card_slug_history where old_slug = new.slug;
    -- Keep the 5 most recent so renames can't squat on addresses.
    delete from public.card_slug_history where card_id = new.id and old_slug in (
      select old_slug from public.card_slug_history where card_id = new.id
      order by created_at desc offset 5);
  end if;
  return new;
end $$;
create trigger cards_remember_old_slug after update of slug on public.cards
  for each row execute function public.remember_old_slug();

-- A forwarding address belongs to its card. 23505 so callers treat it like
-- any taken address (createCard retries with a suffix; the editor says "taken").
create or replace function public.reserve_old_slugs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.card_slug_history
             where old_slug = new.slug and card_id <> new.id) then
    raise exception 'That card address is taken' using errcode = '23505';
  end if;
  return new;
end $$;
create trigger cards_reserve_old_slugs before insert or update of slug on public.cards
  for each row execute function public.reserve_old_slugs();

revoke execute on function public.remember_old_slug() from public, anon, authenticated;
revoke execute on function public.reserve_old_slugs() from public, anon, authenticated;

-- Public: an old address → the card's current one (null if none).
create or replace function public.resolve_card_slug(_slug text)
returns text language sql stable security definer set search_path = public as $$
  select c.slug from public.card_slug_history h join public.cards c on c.id = h.card_id
  where h.old_slug = lower(_slug)
$$;
revoke execute on function public.resolve_card_slug(text) from public;
grant execute on function public.resolve_card_slug(text) to anon, authenticated;

-- ---- 2. Premium analytics -----------------------------------------------------
-- Visitor ids, devices, referrers and link labels are Premium data. Members
-- can still read their own event counts directly; the breakdowns come only
-- from premium_card_insights, which checks the plan in the database.

revoke select on public.card_views from authenticated;
grant select (id, card_id, user_id, event_type, created_at) on public.card_views to authenticated;

create or replace function public.premium_card_insights(p_since timestamptz, p_card uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or public.effective_plan(uid) <> 'premium' then
    raise exception 'Advanced analytics is a Premium feature' using errcode = '42501';
  end if;
  return (
    with v as (
      select event_type, meta, referrer, device, visitor from public.card_views
      where user_id = uid and created_at >= p_since and (p_card is null or card_id = p_card)
    )
    select jsonb_build_object(
      'unique', (select count(distinct visitor) from v where event_type = 'view'),
      'devices', coalesce((select jsonb_agg(jsonb_build_array(device, n) order by n desc)
        from (select device, count(*) n from v where event_type = 'view' and device is not null
              group by device) d), '[]'::jsonb),
      'referrers', coalesce((select jsonb_agg(jsonb_build_array(referrer, n) order by n desc)
        from (select referrer, count(*) n from v where event_type = 'view' and referrer is not null
              group by referrer order by n desc limit 6) r), '[]'::jsonb),
      'clicks', coalesce((select jsonb_agg(jsonb_build_array(label, n) order by n desc)
        from (select coalesce(nullif(meta, ''), 'link') label, count(*) n from v
              where event_type = 'click' group by 1 order by n desc limit 8) c), '[]'::jsonb)
    ));
end $$;
revoke execute on function public.premium_card_insights(timestamptz, uuid) from public, anon;
grant execute on function public.premium_card_insights(timestamptz, uuid) to authenticated;

-- ---- 3. Pinball refunds ------------------------------------------------------
-- A refunded order stops counting: pending grants never apply, Pro from a
-- refunded Lifetime/Year falls back to whatever else the account has, and a
-- refunded starter pack loses its unused credits. Cards are never touched.

alter table public.purchase_entitlements add column refunded_at timestamptz;

create or replace function public.apply_purchase_entitlements(_user uuid, _email text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.purchase_entitlements%rowtype;
begin
  if not exists (select 1 from auth.users where id = _user
    and lower(email) = lower(_email) and email_confirmed_at is not null) then return; end if;
  perform 1 from public.profiles where id = _user for update;
  if not found then return; end if;
  for r in select * from public.purchase_entitlements
    where email = lower(_email) and applied_at is null and applied_to is null and not is_test
      and refunded_at is null
    order by case kind when 'lifetime' then 0 when 'year' then 1 else 2 end, id for update
  loop
    if r.kind = 'lifetime' then
      update public.profiles set plan = 'pro', plan_expires_at = null
        where id = _user and plan <> 'premium';
    elsif r.kind = 'year' then
      update public.profiles set plan = 'pro', plan_expires_at = case
        when plan = 'pro' and plan_expires_at is null then null
        else greatest(coalesce(plan_expires_at, now()), now()) + interval '1 year' end
        where id = _user and plan <> 'premium';
    else
      update public.profiles set credit_scan = credit_scan + 25,
        credit_follow_up = credit_follow_up + 25 where id = _user;
    end if;
    update public.purchase_entitlements set applied_to = _user, applied_at = now()
      where id = r.id and applied_at is null and applied_to is null;
  end loop;
end $$;

create or replace function public.restore_entitlement_plan(_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _lifetime boolean; _year_until timestamptz;
begin
  select bool_or(kind = 'lifetime'),
         max(applied_at + interval '1 year') filter (where kind = 'year')
    into _lifetime, _year_until
    from public.purchase_entitlements
    where applied_to = _user and not is_test and applied_at is not null and refunded_at is null;
  if coalesce(_lifetime, false) then
    update public.profiles set plan = 'pro', plan_expires_at = null where id = _user;
  elsif _year_until is not null and _year_until > now() then
    update public.profiles set plan = 'pro', plan_expires_at = _year_until where id = _user;
  else
    update public.profiles set plan = 'free', plan_expires_at = null where id = _user;
  end if;
end $$;

-- Service role only (the refund webhook). Idempotent per order + kind.
create or replace function public.refund_app_purchase(_order_id text, _kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.purchase_entitlements%rowtype; p public.profiles%rowtype;
begin
  select * into r from public.purchase_entitlements
    where pinball_order_id = _order_id and kind = _kind for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown order'); end if;
  if r.refunded_at is not null then return jsonb_build_object('ok', true, 'replay', true); end if;
  update public.purchase_entitlements set refunded_at = now() where id = r.id;
  if r.applied_to is null or r.is_test then
    return jsonb_build_object('ok', true, 'result', 'not_applied');
  end if;
  select * into p from public.profiles where id = r.applied_to for update;
  if not found then return jsonb_build_object('ok', true, 'result', 'no_account'); end if;
  if r.kind = 'starter' then
    update public.profiles set credit_scan = greatest(credit_scan - 25, 0),
      credit_follow_up = greatest(credit_follow_up - 25, 0) where id = p.id;
    return jsonb_build_object('ok', true, 'result', 'credits_removed');
  end if;
  -- Pro or Premium that comes from Stripe, Premium, or a comp stays as it is.
  if p.stripe_subscription_id is not null or p.plan = 'premium'
     or exists (select 1 from public.signup_grants where claimed_by = p.id) then
    return jsonb_build_object('ok', true, 'result', 'plan_kept');
  end if;
  perform public.restore_entitlement_plan(p.id);
  return jsonb_build_object('ok', true, 'result', 'plan_recomputed');
end $$;
revoke execute on function public.refund_app_purchase(text, text) from public, anon, authenticated;
grant execute on function public.refund_app_purchase(text, text) to service_role;
