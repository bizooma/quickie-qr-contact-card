-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Platform-owner bootstrap: emails in admin_emails get is_admin + Premium
-- automatically the moment their account is created (works for email or
-- OAuth signups alike), and retroactively if the account already exists.

create table if not exists public.admin_emails (email text primary key);
insert into public.admin_emails (email) values ('kale@myaisummit.dev')
  on conflict do nothing;
alter table public.admin_emails enable row level security;
-- No policies on purpose: service role / definer functions only.

create or replace function public.grant_admin_on_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare e text;
begin
  select lower(email) into e from auth.users where id = new.id;
  if e is not null and exists (select 1 from public.admin_emails a where lower(a.email) = e) then
    update public.profiles
      set is_admin = true, plan = 'premium', plan_expires_at = null
      where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists profiles_grant_admin on public.profiles;
create trigger profiles_grant_admin after insert on public.profiles
  for each row execute function public.grant_admin_on_signup();

-- Retroactive, in case the account already exists.
update public.profiles p
  set is_admin = true, plan = 'premium', plan_expires_at = null
  from auth.users u
  where u.id = p.id and lower(u.email) in (select lower(email) from public.admin_emails);
