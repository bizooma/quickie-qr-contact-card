-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- One-time signup comps: match by email (preferred) or display name; the
-- first matching signup claims the grant and gets the plan applied.
-- Seeded with an unlimited-Premium grant for Rachael King (by name).

create table public.signup_grants (
  id uuid primary key default gen_random_uuid(),
  match_email text,  -- lower-case
  match_name text,   -- lower-case full name (Google signups carry it)
  plan text not null check (plan in ('pro','premium')),
  grant_months integer,  -- null = lifetime
  note text,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check (match_email is not null or match_name is not null)
);
alter table public.signup_grants enable row level security;
-- No policies on purpose: service role / definer functions only.

create or replace function public.apply_signup_grants()
returns trigger language plpgsql security definer set search_path = public as $$
declare e text; g record;
begin
  select lower(email) into e from auth.users where id = new.id;
  select * into g from public.signup_grants
    where claimed_at is null
      and ((match_email is not null and match_email = e)
        or (match_name is not null and match_name = lower(coalesce(new.display_name, ''))))
    order by match_email is not null desc, created_at
    limit 1;
  if g.id is null then return new; end if;
  update public.profiles set
      plan = g.plan,
      plan_expires_at = case when g.grant_months is null then null
                             else now() + make_interval(months => g.grant_months) end
    where id = new.id;
  update public.signup_grants set claimed_by = new.id, claimed_at = now() where id = g.id;
  return new;
end $$;

drop trigger if exists profiles_signup_grants on public.profiles;
create trigger profiles_signup_grants after insert on public.profiles
  for each row execute function public.apply_signup_grants();

insert into public.signup_grants (match_name, plan, grant_months, note)
  values ('rachael king', 'premium', null, 'Unlimited Premium — comped by Kale');
