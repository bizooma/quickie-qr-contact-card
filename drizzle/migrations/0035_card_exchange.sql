-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Contact exchange settings on a card: which details "Save contact" leaves
-- out, and the owner's own share-back form (paid plans). Purely additive:
-- existing cards keep a null value and behave exactly as before. The
-- submit_shareback function and its spam limits are not touched.

alter table public.cards add column exchange jsonb; -- null means "use the defaults"

-- The authoritative guard (src/lib/exchange.ts mirrors it for instant
-- feedback). Only known keys, enumerated names, booleans and short question
-- labels are accepted. Returns false, never null: a CHECK treats null as a pass.
create or replace function public.valid_card_exchange(x jsonb)
returns boolean language sql immutable set search_path = public as $fn$
  select coalesce(case
    when x is null then true
    when jsonb_typeof(x) <> 'object' then false
    when length(x::text) > 1500 then false
    else
      not exists (select 1 from jsonb_object_keys(x) k where k not in ('vcardHide','form'))
      and (x->'vcardHide' is null or case
            when jsonb_typeof(x->'vcardHide') <> 'array' then false
            else jsonb_array_length(x->'vcardHide') <= 8
                 and not exists (select 1 from jsonb_array_elements(x->'vcardHide') v
                                 where jsonb_typeof(v) <> 'string'
                                    or (v #>> '{}') not in ('phones','emails','company','website','location','bio','links','photo'))
          end)
      and (x->'form' is null or case
            when jsonb_typeof(x->'form') <> 'object' then false
            else
              not exists (select 1 from jsonb_object_keys(x->'form') k
                          where k not in ('require','company','note','questions'))
              and (x->'form'->'require' is null or x->'form'->>'require' in ('either','email','phone','both'))
              and (x->'form'->'company' is null or jsonb_typeof(x->'form'->'company') = 'boolean')
              and (x->'form'->'note' is null or jsonb_typeof(x->'form'->'note') = 'boolean')
              and (x->'form'->'questions' is null or case
                    when jsonb_typeof(x->'form'->'questions') <> 'array' then false
                    else jsonb_array_length(x->'form'->'questions') <= 3
                         and not exists (
                           select 1 from jsonb_array_elements(x->'form'->'questions') q
                           where case
                             when jsonb_typeof(q) <> 'object' then true
                             else exists (select 1 from jsonb_object_keys(q) k where k not in ('label','required'))
                                  or jsonb_typeof(q->'label') is distinct from 'string'
                                  or char_length(btrim(q->>'label')) not between 1 and 80
                                  or (q->'required' is not null and jsonb_typeof(q->'required') <> 'boolean')
                           end)
                  end)
          end)
  end, false);
$fn$;

-- The owner's own form is a paid feature: the public card leaves it out on the
-- free plan, and submitShareback (capture.functions.ts) applies it only for
-- paid owners. What "Save contact" includes is open to every plan.
create or replace function public.public_card_exchange(x jsonb, plan text)
returns jsonb language sql immutable set search_path = public as $fn$
  select case
    when x is null or jsonb_typeof(x) <> 'object' then null
    when plan <> 'free' then x
    else nullif(x - 'form', '{}'::jsonb)
  end;
$fn$;
revoke execute on function public.public_card_exchange(jsonb, text) from public, anon, authenticated;

alter table public.cards add constraint cards_exchange_valid check (public.valid_card_exchange(exchange));

-- get_public_card gains one key, exchange. The owner's plan is now worked out
-- once per call instead of once per key that depends on it.
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
    'verified', coalesce((select p.verified_at is not null from public.profiles p where p.id = c.user_id), false),
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url, 'icon', l.icon) order by l.position, l.created_at)
                       from public.card_links l where l.card_id = c.id), '[]'::jsonb))
  from public.cards c
  cross join lateral (select public.effective_plan(c.user_id) as plan) pl
  where c.slug = lower(_slug);
$fn$;

notify pgrst, 'reload schema';
