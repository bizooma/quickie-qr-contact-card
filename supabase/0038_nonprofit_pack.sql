-- 0038: the nonprofit pack, and low-profile cards.
-- 1. valid_card_practice accepts kind 'nonprofit' with its own keys (each kind
--    may only carry its own keys).
-- 2. get_public_card applies low-profile mode server-side: the person's name,
--    title, headshot and link-preview image never leave the database.

-- https only: a card can never carry a javascript: or data: link.
create or replace function public.valid_pack_url(u jsonb)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select u is null or (jsonb_typeof(u) = 'string'
    and char_length(u #>> '{}') <= 500
    and (u #>> '{}') ~* '^https://[^[:space:]/]+\.[^[:space:]]+$');
$function$;

create or replace function public.valid_card_practice(p jsonb)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select coalesce(case
    when p is null then true
    when jsonb_typeof(p) <> 'object' then false
    when length(p::text) > 3000 then false
    when p->>'kind' = 'attorney' then
      not exists (select 1 from jsonb_object_keys(p) k
                  where k not in ('kind','admissions','areas','disclaimer','consultUrl','consent'))
      and (p->'admissions' is null or case
            when jsonb_typeof(p->'admissions') <> 'array' then false
            else jsonb_array_length(p->'admissions') <= 6
                 and not exists (
                   select 1 from jsonb_array_elements(p->'admissions') a
                   where case
                     when jsonb_typeof(a) <> 'object' then true
                     else exists (select 1 from jsonb_object_keys(a) k where k not in ('state','number'))
                          or jsonb_typeof(a->'state') is distinct from 'string'
                          or char_length(btrim(a->>'state')) not between 1 and 40
                          or (a->'number' is not null and (jsonb_typeof(a->'number') <> 'string'
                              or char_length(a->>'number') > 20))
                   end)
          end)
      and (p->'areas' is null or case
            when jsonb_typeof(p->'areas') <> 'array' then false
            else jsonb_array_length(p->'areas') <= 8
                 and not exists (select 1 from jsonb_array_elements(p->'areas') v
                                 where jsonb_typeof(v) <> 'string'
                                    or char_length(btrim(v #>> '{}')) not between 1 and 40)
          end)
      and (p->'disclaimer' is null or (jsonb_typeof(p->'disclaimer') = 'string'
           and char_length(p->>'disclaimer') <= 400))
      and public.valid_pack_url(p->'consultUrl')
      and (p->'consent' is null or jsonb_typeof(p->'consent') = 'boolean')
    when p->>'kind' = 'nonprofit' then
      not exists (select 1 from jsonb_object_keys(p) k
                  where k not in ('kind','exempt','ein','donateUrl','disclosure','stateReg',
                                  'interests','lowProfile'))
      and (p->'exempt' is null or jsonb_typeof(p->'exempt') = 'boolean')
      and (p->'ein' is null or (jsonb_typeof(p->'ein') = 'string' and p->>'ein' ~ '^\d{2}-\d{7}$'))
      and public.valid_pack_url(p->'donateUrl')
      and (p->'disclosure' is null or (jsonb_typeof(p->'disclosure') = 'string'
           and char_length(p->>'disclosure') <= 600))
      and (p->'stateReg' is null or (jsonb_typeof(p->'stateReg') = 'string'
           and char_length(p->>'stateReg') <= 30))
      and (p->'interests' is null or jsonb_typeof(p->'interests') = 'boolean')
      and (p->'lowProfile' is null or jsonb_typeof(p->'lowProfile') = 'boolean')
    else false
  end, false);
$function$;

create or replace function public.get_public_card(_slug text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'slug', c.slug, 'label', c.label,
    -- Low profile: the organization stands in for the person.
    'full_name', case when lp.low then coalesce(nullif(btrim(c.company), ''), c.full_name) else c.full_name end,
    'job_title', case when lp.low then null else c.job_title end,
    -- ...and isn't repeated as the company line.
    'company', case when lp.low and nullif(btrim(c.company), '') is not null then null else c.company end,
    'phones', c.phones, 'emails', c.emails, 'website', c.website, 'location', c.location, 'bio', c.bio,
    'headshot_path', case when lp.low then null else c.headshot_path end,
    'logo_path', c.logo_path, 'accent_color', c.accent_color,
    'background_color', c.background_color, 'font', c.font, 'template', c.template,
    'og_path', case when lp.low then null else c.og_path end,
    'logo_size', c.logo_size,
    'banner_path', case when pl.plan = 'premium' then c.banner_path end,
    'shareback_open', public.shareback_open(c.user_id),
    'theme', public.public_card_theme(c.theme, pl.plan),
    'exchange', public.public_card_exchange(c.exchange, pl.plan),
    'practice', c.practice,
    'hide_branding', public.card_branding_hidden(c.user_id),
    'verified', coalesce((select p.verified_at is not null from public.profiles p where p.id = c.user_id), false),
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url, 'icon', l.icon) order by l.position, l.created_at)
                       from public.card_links l where l.card_id = c.id), '[]'::jsonb))
  from public.cards c
  cross join lateral (select public.effective_plan(c.user_id) as plan) pl
  cross join lateral (select coalesce(c.practice->>'kind' = 'nonprofit'
                                      and (c.practice->>'lowProfile')::boolean, false) as low) lp
  where c.slug = lower(_slug);
$function$;
