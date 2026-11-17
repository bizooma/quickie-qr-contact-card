-- 0040: the follow-up queue.
--
-- Every new contact (scanned, shared back, or added by hand) is due for a
-- follow-up as soon as it's saved. The owner sends it, snoozes it (moves the
-- due time) or closes it. The AI draft is kept on the contact so opening it
-- again doesn't cost another AI call. A morning push sums up what's waiting,
-- at about 8-10am in the person's own time zone.
--
-- Additive only: new nullable columns, one index, one trigger, one
-- service-role function. Existing rows get follow_up_due_at = now() from the
-- default (there are none in production today).

alter table public.contacts
  add column if not exists follow_up_due_at timestamptz default now(),
  add column if not exists follow_up_done_at timestamptz,
  add column if not exists follow_up_outcome text,
  add column if not exists follow_up_draft jsonb;

alter table public.contacts
  drop constraint if exists contacts_follow_up_outcome_check,
  add constraint contacts_follow_up_outcome_check
    check (follow_up_outcome is null or follow_up_outcome in ('sent', 'skipped'));

alter table public.contacts
  drop constraint if exists contacts_follow_up_draft_check,
  add constraint contacts_follow_up_draft_check
    check (
      follow_up_draft is null
      or (jsonb_typeof(follow_up_draft) = 'object' and octet_length(follow_up_draft::text) <= 20000)
    );

create index if not exists contacts_follow_up_queue_idx
  on public.contacts (user_id, follow_up_due_at)
  where follow_up_done_at is null and follow_up_due_at is not null;

-- The person's IANA time zone ("America/New_York"), set by the app on load,
-- and the local date their last morning summary went out.
alter table public.profiles
  add column if not exists time_zone text,
  add column if not exists follow_up_digest_on date;

-- profiles uses column grants: the owner may set their time zone, not the
-- digest date (only the server writes that).
grant update (time_zone) on public.profiles to authenticated;

-- An unknown zone would make "now() at time zone" throw inside the digest
-- query, so anything Postgres doesn't know is stored as null.
create or replace function public.profiles_clean_time_zone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.time_zone is not null
     and (length(new.time_zone) > 64
          or not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone)) then
    new.time_zone := null;
  end if;
  return new;
end $$;

drop trigger if exists profiles_clean_time_zone on public.profiles;
create trigger profiles_clean_time_zone
  before insert or update of time_zone on public.profiles
  for each row execute function public.profiles_clean_time_zone();

-- Who gets a morning summary on this cron run: people with a push
-- subscription, whose local time is 8:00-10:59, who haven't had one today,
-- and who have follow-ups due from before today (or snoozed until now).
-- Returns the count, one name (for "Follow up with Jane"), the event most
-- of them came from (for "14 people from the JBA mixer"), and the person's
-- local date (stored as follow_up_digest_on once the push is sent).
create or replace function public.follow_up_digest_candidates(p_limit int default 100)
returns table (user_id uuid, due_count int, sample_name text, event_name text, local_today date)
language sql
stable
security definer
set search_path = public
as $$
  with people as (
    select p.id, p.time_zone,
           (now() at time zone p.time_zone)::date as local_today,
           date_trunc('day', now() at time zone p.time_zone) at time zone p.time_zone as local_midnight
    from public.profiles p
    where p.time_zone is not null
      and extract(hour from now() at time zone p.time_zone) between 8 and 10
      and (p.follow_up_digest_on is null
           or p.follow_up_digest_on < (now() at time zone p.time_zone)::date)
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
  ),
  due as (
    select c.user_id, c.full_name, c.event_id, pe.local_today
    from people pe
    join public.contacts c on c.user_id = pe.id
    where c.follow_up_done_at is null
      and c.follow_up_due_at is not null
      and c.follow_up_due_at <= now()
      and (c.created_at < pe.local_midnight or c.follow_up_due_at > c.created_at + interval '1 minute')
  )
  select d.user_id,
         count(*)::int,
         min(d.full_name),
         (select e.name from due d2 join public.events e on e.id = d2.event_id
           where d2.user_id = d.user_id
           group by e.name order by count(*) desc, e.name limit 1),
         min(d.local_today)
  from due d
  group by d.user_id
  limit greatest(1, least(p_limit, 500));
$$;

revoke all on function public.follow_up_digest_candidates(int) from public, anon, authenticated;
grant execute on function public.follow_up_digest_candidates(int) to service_role;
