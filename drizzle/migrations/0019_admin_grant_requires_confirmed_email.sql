-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Supersedes the unconfirmed grant_admin_on_signup in 0010: admin + Premium are
-- granted only once the account's email is confirmed (signup if already
-- confirmed, e.g. Google; otherwise on confirmation). Idempotent.

create or replace function public.grant_admin_on_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare e text;
begin
  select lower(email) into e from auth.users where id = new.id and email_confirmed_at is not null;
  if e is not null and exists (select 1 from public.admin_emails a where lower(a.email) = e) then
    update public.profiles set is_admin = true, plan = 'premium', plan_expires_at = null where id = new.id;
  end if;
  return new;
end $$;

create or replace function public.grant_admin_on_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email)) then
    update public.profiles set is_admin = true, plan = 'premium', plan_expires_at = null where id = new.id;
  end if;
  return new;
end $$;
