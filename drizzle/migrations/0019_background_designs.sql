-- Saved virtual-background designs, one per card (applied live on
-- 2026-10-12; this file is the record). The design is the editor's JSON
-- (fill + layers); uploaded pictures live in the private card-media bucket
-- under the owner's folder and are referenced by path.

create table if not exists public.background_designs (
  card_id uuid primary key references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  design jsonb not null check (octet_length(design::text) <= 100000),
  updated_at timestamptz not null default now()
);

create index if not exists background_designs_user_idx on public.background_designs (user_id);

alter table public.background_designs enable row level security;

-- Owners only, and only for their own cards (org admins can see teammates'
-- cards, but backgrounds stay personal).
drop policy if exists "own background designs" on public.background_designs;
create policy "own background designs" on public.background_designs
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = auth.uid())
  );

-- Match 0015's least-privilege grants: no anon access, RLS-governed DML only.
revoke all on public.background_designs from anon;
revoke all on public.background_designs from authenticated;
grant select, insert, update, delete on public.background_designs to authenticated;
