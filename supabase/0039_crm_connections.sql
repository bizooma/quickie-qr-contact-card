-- 0039: CRM connections (Clio Grow first) and a delivery log.
-- Additive only: two new tables, nothing existing changes.

-- One row per user per CRM. Holds the CRM credential, so no client role can
-- touch it at all: RLS is on with no policies, and table grants are revoked.
-- Only server functions (service role) read or write it; the browser only
-- ever sees the status they return (connected, region, last 4 of the token).
create table public.crm_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('clio_grow')),
  region text check (region in ('us', 'eu', 'au', 'ca')),
  secret text not null check (char_length(secret) between 8 and 200),
  secret_hint text check (char_length(secret_hint) <= 8),
  last_error text check (char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.crm_connections enable row level security;
revoke all on public.crm_connections from anon, authenticated;

-- Every attempt to send a contact to a CRM, so the owner can see that a lead
-- arrived (or why it didn't) and resend it. Owners read their own rows;
-- only the service role writes.
create table public.crm_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  provider text not null check (provider in ('clio_grow')),
  ok boolean not null,
  error text check (char_length(error) <= 300),
  created_at timestamptz not null default now()
);
create index crm_deliveries_contact_idx on public.crm_deliveries (contact_id, created_at desc);
alter table public.crm_deliveries enable row level security;
revoke all on public.crm_deliveries from anon, authenticated;
grant select on public.crm_deliveries to authenticated;
create policy "Owners read their own CRM deliveries" on public.crm_deliveries
  for select to authenticated using (user_id = auth.uid());
