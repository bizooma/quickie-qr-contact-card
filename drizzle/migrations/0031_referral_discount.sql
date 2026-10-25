-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Referral discount (src/lib/referral.ts): a referred friend gets 20% off their
-- first Pro/Premium payment; when they pay, the referrer gets 20% off their next
-- payment, then 10% off every payment for as long as the friend keeps paying,
-- stacking per friend up to 100%. Referrals themselves come from 0027.

alter table public.referrals
  add column first_paid_at timestamptz,          -- the friend's first paid subscription
  add column bonus_applied_at timestamptz,       -- referrer's one-time 20% used
  add column friend_discount_used_at timestamptz; -- friend's own 20% used

-- The referrer's friends who are paying right now (Stripe subscription on
-- Pro or Premium), oldest first, with whether the one-time bonus is unused.
create or replace function public.referral_reward_state(_owner uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'bonus_pending', r.bonus_applied_at is null)
           order by r.first_paid_at), '[]'::jsonb)
  from public.referrals r
  join public.profiles p on p.id = r.referred_user_id
  where r.owner_user_id = _owner
    and r.first_paid_at is not null
    and p.stripe_subscription_id is not null
    and p.plan in ('pro', 'premium')
$$;
revoke execute on function public.referral_reward_state(uuid) from public, anon, authenticated;
grant execute on function public.referral_reward_state(uuid) to service_role;

-- What Settings → Invite friends shows the signed-in user: counts only, never
-- who their friends are.
create or replace function public.my_referral_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  with paying as (
    select r.bonus_applied_at from public.referrals r
    join public.profiles p on p.id = r.referred_user_id
    where r.owner_user_id = auth.uid() and r.first_paid_at is not null
      and p.stripe_subscription_id is not null and p.plan in ('pro', 'premium')
  )
  select jsonb_build_object(
    'signups', (select count(*) from public.referrals where owner_user_id = auth.uid()),
    'paying', (select count(*) from paying),
    'bonus_pending', (select count(*) from paying where bonus_applied_at is null),
    'friend_discount', exists (select 1 from public.referrals
      where referred_user_id = auth.uid() and friend_discount_used_at is null),
    'card_slug', (select slug from public.cards where user_id = auth.uid()
      order by created_at limit 1))
$$;
revoke execute on function public.my_referral_summary() from public, anon;
grant execute on function public.my_referral_summary() to authenticated;
