-- Event mode (Pro and Premium) and follow-up reminders (Premium). Applied
-- live on 2026-10-13; this file is the record.
--
-- Event mode: a user starts an event ("Denver Realtor Expo"); while it is
-- active, every new contact they get (share-backs, scans, manual adds) is
-- tagged with it by a trigger, so all capture paths are covered in one place.
-- Reminders: "follow up with Dana in 3 days"; a pg_cron job calls the app's
-- /api/cron/reminders route every 15 minutes, which sends a push notification
-- for each due reminder.

-- ---------- plan helper ----------
-- The same rules as the app's effectivePlan(): an unexpired paid plan, and
-- team members get Premium. Only called from SECURITY DEFINER triggers.
create or replace function public.effective_plan(_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when public.has_team_seat(_user) then 'premium'
      when p.plan in ('pro', 'premium') and (p.plan_expires_at is null or p.plan_expires_at > now())
        then p.plan
      else 'free'
    end
    from public.profiles p where p.id = _user
  ), 'free')
$$;
revoke execute on function public.effective_plan(uuid) from public, anon, authenticated;
-- The reminders cron route (service role) re-checks the plan before sending.
grant execute on function public.effective_plan(uuid) to service_role;

-- ---------- events ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists events_user_idx on public.events (user_id, created_at desc);
create unique index if not exists events_one_active_idx on public.events (user_id) where is_active;
alter table public.events enable row level security;
drop policy if exists "own events" on public.events;
create policy "own events" on public.events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.events from anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;

-- Pro/Premium only, and starting an event ends whichever one was running.
create or replace function public.events_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and public.effective_plan(new.user_id) not in ('pro', 'premium') then
    raise exception 'Event mode is a Pro feature — upgrade to use it';
  end if;
  if new.is_active then
    update public.events set is_active = false
      where user_id = new.user_id and id <> new.id and is_active;
  end if;
  return new;
end $$;
revoke execute on function public.events_guard() from public, anon, authenticated;
drop trigger if exists events_guard on public.events;
create trigger events_guard before insert or update on public.events
  for each row execute function public.events_guard();

-- ---------- contacts.event_id ----------
alter table public.contacts
  add column if not exists event_id uuid references public.events(id) on delete set null;
create index if not exists contacts_event_idx on public.contacts (event_id) where event_id is not null;

-- New contacts join the owner's running event; an event id that isn't the
-- owner's own is dropped (the FK alone doesn't check ownership).
create or replace function public.contacts_event_tag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.event_id is not null
     and not exists (select 1 from public.events e where e.id = new.event_id and e.user_id = new.user_id) then
    new.event_id := null;
  end if;
  if tg_op = 'INSERT' and new.event_id is null then
    select e.id into new.event_id from public.events e
      where e.user_id = new.user_id and e.is_active
        and (e.ends_on is null or e.ends_on >= current_date)
        and public.effective_plan(new.user_id) in ('pro', 'premium')
      limit 1;
  end if;
  return new;
end $$;
revoke execute on function public.contacts_event_tag() from public, anon, authenticated;
drop trigger if exists contacts_event_tag on public.contacts;
create trigger contacts_event_tag before insert or update of event_id on public.contacts
  for each row execute function public.contacts_event_tag();

-- ---------- follow-up reminders ----------
create table if not exists public.contact_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  remind_at timestamptz not null,
  note text check (note is null or length(note) <= 300),
  done_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists contact_reminders_user_idx on public.contact_reminders (user_id, remind_at);
create index if not exists contact_reminders_due_idx on public.contact_reminders (remind_at)
  where done_at is null and notified_at is null;
alter table public.contact_reminders enable row level security;
drop policy if exists "own reminders" on public.contact_reminders;
create policy "own reminders" on public.contact_reminders for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.contacts c where c.id = contact_id and c.user_id = auth.uid())
  );
revoke all on public.contact_reminders from anon, authenticated;
grant select, insert, update, delete on public.contact_reminders to authenticated;

create or replace function public.reminders_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.effective_plan(new.user_id) <> 'premium' then
    raise exception 'Follow-up reminders are a Premium feature — upgrade to use them';
  end if;
  if (select count(*) from public.contact_reminders
      where user_id = new.user_id and done_at is null) >= 500 then
    raise exception 'Too many open reminders — mark some done first';
  end if;
  return new;
end $$;
revoke execute on function public.reminders_guard() from public, anon, authenticated;
drop trigger if exists reminders_guard on public.contact_reminders;
create trigger reminders_guard before insert on public.contact_reminders
  for each row execute function public.reminders_guard();

-- ---------- push messages ----------
-- Pushes are sent without a payload (no RFC 8291 encryption needed); for a
-- reminder, the service worker fetches its text from /api/push/next with its
-- own subscription endpoint (an unguessable capability URL). One row per
-- subscription, claimed once. Service role only.
create table if not exists public.push_messages (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  title text not null,
  body text not null,
  url text not null default '/app/contacts',
  created_at timestamptz not null default now()
);
create index if not exists push_messages_sub_idx on public.push_messages (subscription_id, created_at);
alter table public.push_messages enable row level security;
revoke all on public.push_messages from anon, authenticated;

-- ---------- schedule ----------
-- The cron secret lives in app_secrets (service role only); the route
-- compares it. Every 15 minutes:
create extension if not exists pg_net;
create extension if not exists pg_cron;
insert into public.app_secrets (key, value)
  values ('cron_reminders', to_jsonb(encode(extensions.gen_random_bytes(32), 'hex')))
  on conflict (key) do nothing;
select cron.unschedule('ck-reminders') where exists (select 1 from cron.job where jobname = 'ck-reminders');
select cron.schedule('ck-reminders', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://contactkickstart.com/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value #>> '{}' from public.app_secrets where key = 'cron_reminders')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
$cron$);
