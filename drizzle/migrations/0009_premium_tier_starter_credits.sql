-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Plan restructure: Pro drops to 3 personal cards; new Premium tier ($12/mo)
-- gets unlimited cards and owns Teams. The $7 Pinball front-end now grants an
-- app "starter pack": one-time AI credits (25 scans + 25 follow-up drafts)
-- consumed only after the free monthly allowance runs out.

alter table public.profiles drop constraint profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan = any (array['free'::text,'pro'::text,'premium'::text]));
alter table public.profiles
  add column credit_scan integer not null default 0,
  add column credit_follow_up integer not null default 0;

alter table public.purchase_entitlements drop constraint purchase_entitlements_kind_check;
alter table public.purchase_entitlements add constraint purchase_entitlements_kind_check check (kind = any (array['lifetime'::text,'year'::text,'starter'::text]));

-- Apply entitlements: lifetime/year grant Pro (never downgrading Premium);
-- starter adds one-time AI credits.
create or replace function public.apply_purchase_entitlements(_user uuid, _email text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public.purchase_entitlements
      where email = lower(_email) and applied_at is null and not is_test
      order by case kind when 'lifetime' then 0 when 'year' then 1 else 2 end
  loop
    if r.kind = 'lifetime' then
      update public.profiles set plan = 'pro', plan_expires_at = null
        where id = _user and plan <> 'premium';
    elsif r.kind = 'year' then
      update public.profiles set plan = 'pro',
        plan_expires_at = case
          when plan = 'pro' and plan_expires_at is null then null -- already lifetime/subscribed
          else greatest(coalesce(plan_expires_at, now()), now()) + interval '1 year'
        end
      where id = _user and plan <> 'premium';
    else -- starter
      update public.profiles
        set credit_scan = credit_scan + 25, credit_follow_up = credit_follow_up + 25
        where id = _user;
    end if;
    update public.purchase_entitlements set applied_to = _user, applied_at = now() where id = r.id;
  end loop;
end $$;

create or replace function public.record_app_purchase(
  _order_id text, _order_number bigint, _event text, _email text, _kind text,
  _amount_cents integer, _is_test boolean, _payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _uid uuid; _existing uuid;
begin
  if _kind not in ('lifetime','year','starter') then return jsonb_build_object('ok', false, 'reason', 'bad kind'); end if;
  select id into _existing from public.purchase_entitlements where pinball_order_id = _order_id and kind = _kind;
  if _existing is not null then return jsonb_build_object('ok', true, 'replay', true); end if;
  insert into public.purchase_entitlements (email, kind, pinball_order_id, order_number, amount_cents, is_test, payload)
    values (lower(_email), _kind, _order_id, _order_number, _amount_cents, _is_test, _payload);
  if _is_test then return jsonb_build_object('ok', true, 'test', true, 'granted', false); end if;
  select id into _uid from auth.users where lower(email) = lower(_email) limit 1;
  if _uid is not null then
    perform public.apply_purchase_entitlements(_uid, _email);
    return jsonb_build_object('ok', true, 'granted', true);
  end if;
  return jsonb_build_object('ok', true, 'granted', false, 'pending', true);
end $$;

-- When a Stripe subscription ends, fall back to whatever the user's applied
-- purchase entitlements still cover instead of hard 'free'.
create or replace function public.restore_entitlement_plan(_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _lifetime boolean; _year_until timestamptz;
begin
  select bool_or(kind = 'lifetime'),
         max(applied_at + interval '1 year') filter (where kind = 'year')
    into _lifetime, _year_until
    from public.purchase_entitlements
    where applied_to = _user and not is_test and applied_at is not null;
  if coalesce(_lifetime, false) then
    update public.profiles set plan = 'pro', plan_expires_at = null where id = _user;
  elsif _year_until is not null and _year_until > now() then
    update public.profiles set plan = 'pro', plan_expires_at = _year_until where id = _user;
  else
    update public.profiles set plan = 'free', plan_expires_at = null where id = _user;
  end if;
end $$;

-- Atomic one-time-credit consumption (PostgREST cannot express a decrement).
create or replace function public.consume_starter_credit(_user uuid, _kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _kind = 'scan' then
    update public.profiles set credit_scan = greatest(credit_scan - 1, 0) where id = _user;
  elsif _kind = 'follow_up' then
    update public.profiles set credit_follow_up = greatest(credit_follow_up - 1, 0) where id = _user;
  end if;
end $$;

revoke execute on function public.restore_entitlement_plan(uuid) from public, anon, authenticated;
revoke execute on function public.consume_starter_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.restore_entitlement_plan(uuid) to service_role;
grant execute on function public.consume_starter_credit(uuid, text) to service_role;

-- Card limit: free 1, Pro 3, Premium unlimited (expiry-aware)
create or replace function public.enforce_card_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text; pe timestamptz; n int; lim int;
begin
  if new.org_id is not null then return new; end if;
  select plan, plan_expires_at into p, pe from public.profiles where id = new.user_id;
  if p = 'premium' and (pe is null or pe > now()) then return new; end if;
  lim := case when p = 'pro' and (pe is null or pe > now()) then 3 else 1 end;
  select count(*) into n from public.cards where user_id = new.user_id and org_id is null;
  if n >= lim then
    raise exception 'Card limit reached — upgrade for more cards';
  end if;
  return new;
end $$;

-- Teams move up to Premium
create or replace function public.enforce_org_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text; pe timestamptz;
begin
  select plan, plan_expires_at into p, pe from public.profiles where id = new.owner_id;
  if not (p = 'premium' and (pe is null or pe > now())) then
    raise exception 'Creating a team requires a Premium plan';
  end if;
  return new;
end $$;
