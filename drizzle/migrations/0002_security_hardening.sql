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
revoke execute on function public.grant_admin_on_confirm() from public, anon, authenticated;

drop trigger if exists users_grant_admin_on_confirm on auth.users;
create trigger users_grant_admin_on_confirm after update of email_confirmed_at, email on auth.users
  for each row execute function public.grant_admin_on_confirm();

revoke insert, update on public.profiles from authenticated;
grant insert (id, display_name, avatar_url, onboarded) on public.profiles to authenticated;
grant update (display_name, avatar_url, onboarded, contacts_seen_at, webhook_url, updated_at) on public.profiles to authenticated;

drop policy if exists "card-media public card read" on storage.objects;