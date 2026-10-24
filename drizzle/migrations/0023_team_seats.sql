-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Team seats: one-step invite acceptance and enforced seat reductions.
--
-- Seat order is the owner first, then members by when they joined. Only the
-- first team_seats people in that order are covered by the team's Premium;
-- when the owner lowers seats, the newest members past the limit keep their
-- membership and data but lose Premium until seats are added or someone
-- leaves. The order lives in SQL (has_team_seat, team_seat_count) and is
-- mirrored for display in src/lib/org-model.ts (seatOrder/uncoveredMembers).

-- Covered only while the team has 3+ seats AND the member is within them.
create or replace function public.has_team_seat(_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members m
    join public.orgs o on o.id = m.org_id
    join public.profiles p on p.id = o.owner_id
    where m.user_id = _user and p.team_seats >= 3
      and (select count(*) from public.org_members x
           where x.org_id = m.org_id
             and (x.role <> 'owner', x.created_at, x.user_id)
               < (m.role <> 'owner', m.created_at, m.user_id)) < p.team_seats
  )
$$;

-- Seats the team pays for, readable by any member (the owner's profile row
-- isn't), so the team page can show who is over the limit.
create or replace function public.team_seat_count(p_org uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
begin
  if public.org_role_of(p_org) is null then
    raise exception 'Not a member of this team' using errcode = '42501';
  end if;
  return (select coalesce(p.team_seats, 0) from public.orgs o
          join public.profiles p on p.id = o.owner_id where o.id = p_org);
end $$;
revoke execute on function public.team_seat_count(uuid) from public, anon;
grant execute on function public.team_seat_count(uuid) to authenticated;

-- Every insert path takes the team's row lock first, so two people can't
-- both take the last seat.
create or replace function public.enforce_seat_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare seats int; adm boolean; cnt int;
begin
  perform 1 from public.orgs where id = new.org_id for update;
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

-- One step: check the invite, take a seat and mark the invite used, all in
-- one transaction. Returns a reason code instead of raising, so the join
-- page can say exactly what's wrong. Service role only (called by the
-- acceptInvite server function with the signed-in user's id).
create or replace function public.accept_team_invite(_token text, _user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv public.org_invites%rowtype; team text; seats int; adm boolean; cnt int; current_org uuid;
begin
  select * into inv from public.org_invites where token = _token for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'invalid'); end if;
  select name into team from public.orgs where id = inv.org_id for update;
  select org_id into current_org from public.org_members where user_id = _user;
  if current_org = inv.org_id then
    return jsonb_build_object('ok', true, 'org_name', team, 'already', true);
  end if;
  if inv.accepted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'used', 'org_name', team);
  end if;
  if inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'expired', 'org_name', team);
  end if;
  if current_org is not null then
    return jsonb_build_object('ok', false, 'code', 'other_team', 'org_name', team);
  end if;
  select p.team_seats, p.is_admin into seats, adm
    from public.orgs o join public.profiles p on p.id = o.owner_id where o.id = inv.org_id;
  select count(*) into cnt from public.org_members where org_id = inv.org_id;
  if not coalesce(adm, false) and cnt >= coalesce(seats, 0) then
    return jsonb_build_object('ok', false, 'code', 'seats_full', 'org_name', team);
  end if;
  begin
    insert into public.org_members (org_id, user_id, role) values (inv.org_id, _user, inv.role);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'other_team', 'org_name', team);
  end;
  update public.org_invites set accepted_by = _user, accepted_at = now() where id = inv.id;
  return jsonb_build_object('ok', true, 'org_name', team);
end $$;
revoke execute on function public.accept_team_invite(text, uuid) from public, anon, authenticated;
grant execute on function public.accept_team_invite(text, uuid) to service_role;
