-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- 1. Two top-up packs instead of one fixed size: the Stripe webhook passes the
--    pack size from the checkout session's metadata (plans.ts TOPUP_PACKS).
drop function if exists public.add_topup_credits(uuid);
create or replace function public.add_topup_credits(_user uuid, _scans int, _follow_ups int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _scans < 0 or _follow_ups < 0 or _scans > 1000 or _follow_ups > 1000 then
    raise exception 'bad top-up size';
  end if;
  update public.profiles
    set credit_scan = credit_scan + _scans, credit_follow_up = credit_follow_up + _follow_ups
    where id = _user;
end $$;
revoke execute on function public.add_topup_credits(uuid, int, int) from public, anon, authenticated;
grant execute on function public.add_topup_credits(uuid, int, int) to service_role;

-- 2. Token log per AI call, so pricing is set from real numbers. Written by
--    the server only (no policies); the admin console can sum it later.
create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  web_searches int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.ai_calls enable row level security;
create index ai_calls_time_idx on public.ai_calls (created_at);
