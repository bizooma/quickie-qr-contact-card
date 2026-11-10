-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Teams only: a team can take the ContactKickstart name off its members'
-- public cards. Purely additive: the switch is off by default, so every
-- existing card shows exactly what it did before.

alter table public.orgs add column hide_branding boolean not null default false;
-- Same column grants as lock_brand and share_contacts; the "org manage"
-- policy already limits updates to the team's owner and admins.
grant select, insert, update (hide_branding) on public.orgs to authenticated;

-- True when the card's owner holds a seat on a team that turned branding
-- off. has_team_seat is the plan check: if the Teams plan lapses or the
-- member loses their seat, the branding comes back by itself.
create or replace function public.card_branding_hidden(_user uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce(
    exists (select 1 from public.org_members m
            join public.orgs o on o.id = m.org_id
            where m.user_id = _user and o.hide_branding)
    and public.has_team_seat(_user), false);
$fn$;
revoke execute on function public.card_branding_hidden(uuid) from public, anon, authenticated;

-- get_public_card gains one key, hide_branding.
create or replace function public.get_public_card(_slug text)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'slug', c.slug, 'label', c.label, 'full_name', c.full_name, 'job_title', c.job_title, 'company', c.company,
    'phones', c.phones, 'emails', c.emails, 'website', c.website, 'location', c.location, 'bio', c.bio,
    'headshot_path', c.headshot_path, 'logo_path', c.logo_path, 'accent_color', c.accent_color,
    'background_color', c.background_color, 'font', c.font, 'template', c.template, 'og_path', c.og_path,
    'logo_size', c.logo_size,
    'banner_path', case when pl.plan = 'premium' then c.banner_path end,
    'shareback_open', public.shareback_open(c.user_id),
    'theme', public.public_card_theme(c.theme, pl.plan),
    'exchange', public.public_card_exchange(c.exchange, pl.plan),
    'hide_branding', public.card_branding_hidden(c.user_id),
    'verified', coalesce((select p.verified_at is not null from public.profiles p where p.id = c.user_id), false),
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url, 'icon', l.icon) order by l.position, l.created_at)
                       from public.card_links l where l.card_id = c.id), '[]'::jsonb))
  from public.cards c
  cross join lateral (select public.effective_plan(c.user_id) as plan) pl
  where c.slug = lower(_slug);
$fn$;

notify pgrst, 'reload schema';
