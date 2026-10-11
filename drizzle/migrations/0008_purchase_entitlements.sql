-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Pinball funnel fulfillment: completed orders for the app products become
-- entitlements (lifetime or one year of Pro), granted immediately for an
-- existing account with the buyer's email and otherwise at signup.
-- The webhook signing secret lives in app_secrets under 'pinball_webhook'.

alter table public.profiles add column plan_expires_at timestamptz;

create table public.purchase_entitlements (
  id uuid primary key default gen_random_uuid(),
  email text not null, -- normalized lower-case
  kind text not null check (kind in ('lifetime','year')),
  pinball_order_id text not null,
  order_number bigint,
  amount_cents integer,
  is_test boolean not null default false,
  payload jsonb,
  created_at timestamptz not null default now(),
  applied_to uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  unique (pinball_order_id, kind)
);
create index purchase_entitlements_pending_idx on public.purchase_entitlements (email) where applied_at is null;
alter table public.purchase_entitlements enable row level security;
-- No policies on purpose: service role only.

create or replace function public.apply_purchase_entitlements(_user uuid, _email text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public.purchase_entitlements
      where email = lower(_email) and applied_at is null and not is_test
      order by case kind when 'lifetime' then 0 else 1 end
  loop
    if r.kind = 'lifetime' then
      update public.profiles set plan = 'pro', plan_expires_at = null where id = _user;
    else
      update public.profiles set plan = 'pro',
        plan_expires_at = case
          when plan = 'pro' and plan_expires_at is null then null -- already lifetime/subscribed
          else greatest(coalesce(plan_expires_at, now()), now()) + interval '1 year'
        end
      where id = _user;
    end if;
    update public.purchase_entitlements set applied_to = _user, applied_at = now() where id = r.id;
  end loop;
end $$;

-- Called by the webhook (service role): records the order idempotently and
-- grants right away when the buyer already has an account.
create or replace function public.record_app_purchase(
  _order_id text, _order_number bigint, _event text, _email text, _kind text,
  _amount_cents integer, _is_test boolean, _payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _uid uuid; _existing uuid;
begin
  if _kind not in ('lifetime','year') then return jsonb_build_object('ok', false, 'reason', 'bad kind'); end if;
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

-- New signups claim any pending entitlement for their (confirmed-at-payment) email.
create or replace function public.claim_entitlements_on_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare e text;
begin
  select lower(email) into e from auth.users where id = new.id;
  if e is not null then perform public.apply_purchase_entitlements(new.id, e); end if;
  return new;
end $$;

create trigger profiles_claim_entitlements after insert on public.profiles
  for each row execute function public.claim_entitlements_on_signup();

revoke execute on function public.apply_purchase_entitlements(uuid, text) from public, anon, authenticated;
revoke execute on function public.record_app_purchase(text, bigint, text, text, text, integer, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.record_app_purchase(text, bigint, text, text, text, integer, boolean, jsonb) to service_role;
grant execute on function public.apply_purchase_entitlements(uuid, text) to service_role;

-- Plan checks in triggers now respect plan_expires_at (a lapsed Founding Year is free)
create or replace function public.enforce_card_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text; pe timestamptz; n int; lim int;
begin
  if new.org_id is not null then return new; end if;
  select plan, plan_expires_at into p, pe from public.profiles where id = new.user_id;
  lim := case when p = 'pro' and (pe is null or pe > now()) then 50 else 1 end;
  select count(*) into n from public.cards where user_id = new.user_id and org_id is null;
  if n >= lim then
    raise exception 'Card limit reached — upgrade to Pro to create more cards';
  end if;
  return new;
end $$;

create or replace function public.enforce_org_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text; pe timestamptz;
begin
  select plan, plan_expires_at into p, pe from public.profiles where id = new.owner_id;
  if not (p = 'pro' and (pe is null or pe > now())) then
    raise exception 'Creating a team requires a Pro plan';
  end if;
  return new;
end $$;
