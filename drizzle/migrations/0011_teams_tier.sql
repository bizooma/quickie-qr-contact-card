-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Teams tier: the org owner buys N seats ($10/user/mo, 3-seat minimum); every
-- member of their team gets Premium-level features while seats are active.
-- Team creation now requires the Teams plan (admins bypass); member inserts
-- are capped by purchased seats (the owner occupies one).

alter table public.profiles add column team_seats integer not null default 0;

create or replace function public.has_team_seat(_user uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members m
    join public.orgs o on o.id = m.org_id
    join public.profiles p on p.id = o.owner_id
    where m.user_id = _user and p.team_seats >= 3
  )
$$;
revoke execute on function public.has_team_seat(uuid) from public, anon, authenticated;
grant execute on function public.has_team_seat(uuid) to service_role;

create or replace function public.enforce_org_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare seats int; adm boolean;
begin
  select team_seats, is_admin into seats, adm from public.profiles where id = new.owner_id;
  if coalesce(adm, false) then return new; end if;
  if coalesce(seats, 0) < 3 then
    raise exception 'Creating a team requires the Teams plan (3+ seats)';
  end if;
  return new;
end $$;

create or replace function public.enforce_seat_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare seats int; adm boolean; cnt int;
begin
  select p.team_seats, p.is_admin into seats, adm
    from public.orgs o join public.profiles p on p.id = o.owner_id
    where o.id = new.org_id;
  if coalesce(adm, false) then return new; end if;
  select count(*) into cnt from public.org_members where org_id = new.org_id;
  if cnt >= coalesce(seats, 0) then
    raise exception 'All team seats are in use — add seats to invite more members';
  end if;
  return new;
end $$;
drop trigger if exists org_members_seat_limit on public.org_members;
create trigger org_members_seat_limit before insert on public.org_members
  for each row execute function public.enforce_seat_limit();

create or replace function public.enforce_card_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare p text; pe timestamptz; n int; lim int;
begin
  if new.org_id is not null then return new; end if;
  select plan, plan_expires_at into p, pe from public.profiles where id = new.user_id;
  if p = 'premium' and (pe is null or pe > now()) then return new; end if;
  if public.has_team_seat(new.user_id) then return new; end if;
  lim := case when p = 'pro' and (pe is null or pe > now()) then 3 else 1 end;
  select count(*) into n from public.cards where user_id = new.user_id and org_id is null;
  if n >= lim then
    raise exception 'Card limit reached — upgrade for more cards';
  end if;
  return new;
end $$;
