-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Signup attribution and the referral loop from public cards.

-- What brought a new account here: UTM codes, Facebook click id, the card they
-- came from. Recorded once by record_signup_attribution; {} = nothing known.
alter table public.profiles add column signup_attribution jsonb;

-- One row per account that signed up from someone's card. The card owner is
-- rewarded with starter scan credits (bonus_scans) — capped per 30 days so a
-- bot farm of signups can't mint unlimited AI usage.
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  source text,
  bonus_scans int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
create policy "owners read their referrals" on public.referrals
  for select to authenticated using (owner_user_id = auth.uid());
create index referrals_owner_time_idx on public.referrals (owner_user_id, created_at);

-- Called once per account from the app's first load (service role, with the
-- verified user id). Stores a cleaned copy of the attribution, and when it
-- names a referring card, credits that card's owner: 5 scans per signup,
-- at most 10 rewarded signups per owner per 30 days. Accounts older than a
-- week, or already recorded, are left alone.
create or replace function public.record_signup_attribution(_user uuid, _attrib jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record; c record; k text; ref_slug text; recent int; bonus int := 0;
  clean jsonb := '{}'::jsonb;
begin
  select id, created_at, signup_attribution into p from public.profiles where id = _user for update;
  if not found or p.signup_attribution is not null or p.created_at < now() - interval '7 days' then
    return jsonb_build_object('stored', false);
  end if;
  foreach k in array array['utm_source','utm_medium','utm_campaign','utm_content','utm_term',
                           'fbclid','ref','ref_card','landing','referrer','at'] loop
    if jsonb_typeof(_attrib -> k) = 'string' then
      clean := clean || jsonb_build_object(k, left(_attrib ->> k, 200));
    end if;
  end loop;
  update public.profiles set signup_attribution = clean where id = _user;

  ref_slug := clean ->> 'ref_card';
  if ref_slug is not null then
    select id, user_id into c from public.cards where cards.slug = lower(ref_slug);
    if c.id is not null and c.user_id <> _user
       and not exists (select 1 from public.referrals r where r.referred_user_id = _user) then
      select count(*) into recent from public.referrals r
        where r.owner_user_id = c.user_id and r.bonus_scans > 0
          and r.created_at > now() - interval '30 days';
      if recent < 10 then bonus := 5; end if;
      insert into public.referrals (referred_user_id, owner_user_id, card_id, source, bonus_scans)
        values (_user, c.user_id, c.id, clean ->> 'ref', bonus);
      if bonus > 0 then
        update public.profiles set credit_scan = credit_scan + bonus where id = c.user_id;
      end if;
      return jsonb_build_object('stored', true, 'referral', true, 'owner', c.user_id, 'bonus', bonus);
    end if;
  end if;
  return jsonb_build_object('stored', true, 'referral', false);
end $$;
revoke execute on function public.record_signup_attribution(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_signup_attribution(uuid, jsonb) to service_role;
