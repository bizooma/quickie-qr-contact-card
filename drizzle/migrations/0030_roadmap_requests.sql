-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- In-app roadmap ("I want this" votes) and feature requests, reached from
-- Settings → Profile → Roadmap & requests.

-- One vote per person per roadmap item (keys live in src/lib/roadmap.ts).
create table public.roadmap_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null check (item_key ~ '^[a-z0-9-]{1,40}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, item_key)
);
alter table public.roadmap_votes enable row level security;
create policy "read own roadmap votes" on public.roadmap_votes
  for select to authenticated using (user_id = auth.uid());
create policy "add own roadmap votes" on public.roadmap_votes
  for insert to authenticated with check (user_id = auth.uid());
create policy "remove own roadmap votes" on public.roadmap_votes
  for delete to authenticated using (user_id = auth.uid());

-- Vote totals per item, without revealing who voted.
create or replace function public.roadmap_vote_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(item_key, n), '{}'::jsonb)
  from (select item_key, count(*) n from public.roadmap_votes group by item_key) v
$$;
revoke execute on function public.roadmap_vote_counts() from public, anon;
grant execute on function public.roadmap_vote_counts() to authenticated;

-- Feature requests. Written by the server (rate limit + admin push), read by
-- their author; the admin console reads and triages them with the service role.
create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) between 10 and 1000),
  status text not null default 'new'
    check (status in ('new', 'planned', 'in_progress', 'done', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.feature_requests enable row level security;
create policy "read own feature requests" on public.feature_requests
  for select to authenticated using (user_id = auth.uid());
create index feature_requests_user_time_idx on public.feature_requests (user_id, created_at);
create index feature_requests_time_idx on public.feature_requests (created_at);
