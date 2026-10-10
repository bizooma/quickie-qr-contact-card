-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Landing page conversion events (CTA clicks, demo views) for the CRO baseline.

create table public.site_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (length(event_type) <= 40),
  meta text check (length(meta) <= 200),
  created_at timestamptz not null default now()
);

alter table public.site_events enable row level security;
-- No policies on purpose: the RPC below is the only write path, and reads go
-- through the service role (admin dashboard), per the architecture rules.

create or replace function public.log_site_event(_event_type text, _meta text default null)
returns void language sql security definer set search_path = public
as $$
  insert into public.site_events (event_type, meta)
  select left(_event_type, 40), left(_meta, 200)
  where _event_type in ('cta_click', 'demo_click', 'pricing_view');
$$;

revoke execute on function public.log_site_event(text, text) from public;
grant execute on function public.log_site_event(text, text) to anon, authenticated, service_role;
