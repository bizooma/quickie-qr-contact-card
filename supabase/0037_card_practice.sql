-- 0037: profession packs (attorney details) on cards.
-- Additive only: one nullable column, a validator, and get_public_card now
-- also returns that column. Free on every plan, so no plan gating.

create or replace function public.valid_card_practice(p jsonb)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select coalesce(case
    when p is null then true
    when jsonb_typeof(p) <> 'object' then false
    when length(p::text) > 2500 then false
    else
      not exists (select 1 from jsonb_object_keys(p) k
                  where k not in ('kind','admissions','areas','disclaimer','consultUrl','consent'))
      and p->>'kind' = 'attorney'
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
      -- https only: a card can never carry a javascript: or data: link.
      and (p->'consultUrl' is null or (jsonb_typeof(p->'consultUrl') = 'string'
           and char_length(p->>'consultUrl') <= 500
           and p->>'consultUrl' ~* '^https://[^[:space:]/]+\.[^[:space:]]+$'))
      and (p->'consent' is null or jsonb_typeof(p->'consent') = 'boolean')
  end, false);
$function$;

alter table public.cards add column if not exists practice jsonb;
alter table public.cards add constraint cards_practice_valid check (public.valid_card_practice(practice));

-- Same as before, plus 'practice'.
create or replace function public.get_public_card(_slug text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
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
    'practice', c.practice,
    'hide_branding', public.card_branding_hidden(c.user_id),
    'verified', coalesce((select p.verified_at is not null from public.profiles p where p.id = c.user_id), false),
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url, 'icon', l.icon) order by l.position, l.created_at)
                       from public.card_links l where l.card_id = c.id), '[]'::jsonb))
  from public.cards c
  cross join lateral (select public.effective_plan(c.user_id) as plan) pl
  where c.slug = lower(_slug);
$function$;
