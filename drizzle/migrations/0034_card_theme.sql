-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Liquid Glass layout and the brand theming engine. Purely additive: existing
-- cards keep a null theme and render exactly as before.
--
-- cards.template is free text, so the new 'glass' layout needs no change here.

alter table public.cards add column theme jsonb; -- null means "use the defaults"
-- Granted by an admin (setUserVerified). Signed-in users hold no column grant
-- on it, so nobody can verify themselves.
alter table public.profiles add column verified_at timestamptz;

-- The authoritative guard for a theme (src/lib/card-theme.ts mirrors it for
-- instant feedback). Only known keys, enumerated names, six-digit hex colours
-- and a short status are accepted, so nothing free-form can reach a style
-- attribute. Returns false, never null: a CHECK treats null as a pass.
create or replace function public.valid_card_theme(t jsonb)
returns boolean language sql immutable set search_path = public as $fn$
  select coalesce(case
    when t is null then true
    when jsonb_typeof(t) <> 'object' then false
    when length(t::text) > 600 then false
    else
      not exists (select 1 from jsonb_object_keys(t) k
                  where k not in ('mesh','meshColors','tint','strength','avatar','bodyFont','status'))
      and (t->'mesh' is null or t->>'mesh' in ('sunset','aurora','ocean','graphite','pearl','brand','custom'))
      and (t->'tint' is null or t->>'tint' in ('clear','frost','smoke'))
      and (t->'strength' is null or t->>'strength' in ('soft','regular','bold'))
      and (t->'avatar' is null or t->>'avatar' in ('circle','squircle','hexagon','blob'))
      and (t->'bodyFont' is null or t->>'bodyFont' in ('sans','display','serif','mono'))
      and (t->'status' is null or (jsonb_typeof(t->'status') = 'string' and char_length(t->>'status') <= 24))
      and (t->'meshColors' is null or case
            when jsonb_typeof(t->'meshColors') <> 'array' then false
            else jsonb_array_length(t->'meshColors') between 2 and 4
                 and not exists (select 1 from jsonb_array_elements(t->'meshColors') c
                                 where jsonb_typeof(c) <> 'string' or (c #>> '{}') !~ '^#[0-9A-Fa-f]{6}$')
          end)
      and (coalesce(t->>'mesh', '') <> 'custom' or t->'meshColors' is not null)
  end, false);
$fn$;

-- Premium settings: custom background colours and the hexagon and blob photo
-- shapes. Same pattern as the banner photo (0033): a trigger refuses the
-- write on other plans, and the public card drops them if the plan lapses.
create or replace function public.theme_needs_premium(t jsonb)
returns boolean language sql immutable set search_path = public as $fn$
  select coalesce(t->>'mesh' = 'custom' or t->'meshColors' is not null
                  or t->>'avatar' in ('hexagon','blob'), false);
$fn$;

create or replace function public.public_card_theme(t jsonb, plan text)
returns jsonb language sql immutable set search_path = public as $fn$
  select case
    when t is null or jsonb_typeof(t) <> 'object' then null
    when plan = 'premium' then t
    else (t - 'meshColors')
      || case when t->>'mesh' = 'custom' then '{"mesh":"brand"}'::jsonb else '{}'::jsonb end
      || case when t->>'avatar' in ('hexagon','blob') then '{"avatar":"circle"}'::jsonb else '{}'::jsonb end
  end;
$fn$;
revoke execute on function public.theme_needs_premium(jsonb) from public, anon, authenticated;
revoke execute on function public.public_card_theme(jsonb, text) from public, anon, authenticated;

create or replace function public.enforce_theme_premium()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if public.theme_needs_premium(new.theme)
     and (tg_op = 'INSERT' or new.theme is distinct from old.theme)
     and public.effective_plan(new.user_id) <> 'premium' then
    raise exception 'Custom background colours and extra photo shapes are Premium features' using errcode = '42501';
  end if;
  return new;
end $fn$;

drop trigger if exists cards_theme_premium on public.cards;
create trigger cards_theme_premium before insert or update on public.cards
  for each row execute function public.enforce_theme_premium();

alter table public.cards add constraint cards_theme_valid check (public.valid_card_theme(theme));

-- get_public_card gains two keys: the theme (Premium settings removed for
-- other plans) and whether the owner is verified.
create or replace function public.get_public_card(_slug text)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'slug', c.slug, 'label', c.label, 'full_name', c.full_name, 'job_title', c.job_title, 'company', c.company,
    'phones', c.phones, 'emails', c.emails, 'website', c.website, 'location', c.location, 'bio', c.bio,
    'headshot_path', c.headshot_path, 'logo_path', c.logo_path, 'accent_color', c.accent_color,
    'background_color', c.background_color, 'font', c.font, 'template', c.template, 'og_path', c.og_path,
    'logo_size', c.logo_size,
    'banner_path', case when public.effective_plan(c.user_id) = 'premium' then c.banner_path end,
    'shareback_open', public.shareback_open(c.user_id),
    'theme', public.public_card_theme(c.theme, public.effective_plan(c.user_id)),
    'verified', coalesce((select p.verified_at is not null from public.profiles p where p.id = c.user_id), false),
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url, 'icon', l.icon) order by l.position, l.created_at)
                       from public.card_links l where l.card_id = c.id), '[]'::jsonb))
  from public.cards c where c.slug = lower(_slug);
$fn$;

notify pgrst, 'reload schema';
