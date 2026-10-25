-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Card look: a bigger company logo (as tall as the profile photo, or larger)
-- and, on Premium, a custom banner photo on the Banner layout.

alter table public.cards
  add column logo_size text not null default 'standard' check (logo_size in ('standard', 'large')),
  add column banner_path text; -- private card-media path; checked by validate_card_media_paths

-- Setting or changing the banner photo is Premium (team seats count). An
-- existing banner can stay through other edits after a downgrade; the public
-- card simply stops showing it (get_public_card below).
create or replace function public.enforce_banner_premium()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.banner_path is not null
     and (tg_op = 'INSERT' or new.banner_path is distinct from old.banner_path)
     and public.effective_plan(new.user_id) <> 'premium' then
    raise exception 'A custom banner photo is a Premium feature' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists cards_banner_premium on public.cards;
create trigger cards_banner_premium before insert or update on public.cards
  for each row execute function public.enforce_banner_premium();

create or replace function public.get_public_card(_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug', c.slug, 'label', c.label, 'full_name', c.full_name, 'job_title', c.job_title, 'company', c.company,
    'phones', c.phones, 'emails', c.emails, 'website', c.website, 'location', c.location, 'bio', c.bio,
    'headshot_path', c.headshot_path, 'logo_path', c.logo_path, 'accent_color', c.accent_color,
    'background_color', c.background_color, 'font', c.font, 'template', c.template, 'og_path', c.og_path,
    'logo_size', c.logo_size,
    'banner_path', case when public.effective_plan(c.user_id) = 'premium' then c.banner_path end,
    'shareback_open', public.shareback_open(c.user_id),
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url, 'icon', l.icon) order by l.position, l.created_at)
                       from public.card_links l where l.card_id = c.id), '[]'::jsonb))
  from public.cards c where c.slug = lower(_slug);
$$;
