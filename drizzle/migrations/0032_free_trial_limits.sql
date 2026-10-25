-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Free becomes a try-before-you-buy plan (src/lib/plans.ts):
-- 1. Share-back: a free owner collects 5 share-backs in total. After that the
--    public card hides the form (get_public_card.shareback_open) and
--    submit_shareback refuses. Paid plans and team seats are uncapped.
-- 2. Cards on free: an account that drops to free keeps every card live, so
--    printed QR codes keep working, but only its oldest personal card stays
--    editable until it upgrades. Deleting a card is always allowed.

-- Mirrors FREE_SHAREBACK_LIMIT in plans.ts.
create or replace function public.shareback_open(_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.effective_plan(_owner) <> 'free'
    or (select count(*) from public.contacts where user_id = _owner and source = 'shareback') < 5
$$;
revoke all on function public.shareback_open(uuid) from public, anon, authenticated;

create or replace function public.get_public_card(_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug', c.slug, 'label', c.label, 'full_name', c.full_name, 'job_title', c.job_title, 'company', c.company,
    'phones', c.phones, 'emails', c.emails, 'website', c.website, 'location', c.location, 'bio', c.bio,
    'headshot_path', c.headshot_path, 'logo_path', c.logo_path, 'accent_color', c.accent_color,
    'background_color', c.background_color, 'font', c.font, 'template', c.template, 'og_path', c.og_path,
    'shareback_open', public.shareback_open(c.user_id),
    'links', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url, 'icon', l.icon) order by l.position, l.created_at)
                       from public.card_links l where l.card_id = c.id), '[]'::jsonb))
  from public.cards c where c.slug = lower(_slug);
$$;

create or replace function public.submit_shareback(_slug text, _name text, _email text, _phone text, _company text, _note text)
returns void language plpgsql security definer set search_path = public as $$
DECLARE c record; recent integer; ip text;
BEGIN
  IF _name IS NULL OR length(trim(_name)) = 0 OR length(_name) > 120 THEN
    RAISE EXCEPTION 'name required'; END IF;
  IF coalesce(trim(_email),'') = '' AND coalesce(trim(_phone),'') = '' THEN
    RAISE EXCEPTION 'email or phone required'; END IF;
  IF length(coalesce(_email,'')) > 255 OR length(coalesce(_phone,'')) > 40 OR
    length(coalesce(_company,'')) > 120 OR length(coalesce(_note,'')) > 1000 THEN
    RAISE EXCEPTION 'input too long'; END IF;
  SELECT id, user_id, label INTO c FROM public.cards WHERE slug = lower(_slug);
  IF c.id IS NULL THEN RAISE EXCEPTION 'card not found'; END IF;
  ip := public.rpc_client_ip_hash();
  IF ip IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('shareback:' || ip, 0));
    SELECT count(*) INTO recent FROM public.rpc_rate_limits
      WHERE ip_hash = ip AND kind = 'shareback' AND created_at > now() - interval '1 hour';
    IF recent >= 20 OR (SELECT count(*) FROM public.rpc_rate_limits WHERE ip_hash = ip
      AND kind = 'shareback' AND card_id = c.id AND created_at > now() - interval '1 hour') >= 5 THEN
      RAISE EXCEPTION 'Too many submissions, try again later' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- Per owner, so the free cap holds across concurrent submissions.
  PERFORM pg_advisory_xact_lock(hashtextextended('shareback-owner:' || c.user_id::text, 0));
  IF NOT public.shareback_open(c.user_id) THEN
    RAISE EXCEPTION 'shareback closed' USING ERRCODE = 'P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('shareback-card:' || c.id::text, 0));
  SELECT count(*) INTO recent FROM public.contacts WHERE card_id = c.id AND source = 'shareback'
    AND created_at > now() - interval '1 hour';
  IF recent >= 300 THEN
    RAISE EXCEPTION 'Too many submissions, try again later' USING ERRCODE = 'P0001'; END IF;
  IF ip IS NOT NULL THEN
    INSERT INTO public.rpc_rate_limits(ip_hash, kind, card_id) VALUES (ip, 'shareback', c.id);
  END IF;
  INSERT INTO public.contacts(user_id, card_id, full_name, email, phone, company, note, source, met_at)
    VALUES (c.user_id, c.id, trim(_name), nullif(trim(_email),''), nullif(trim(_phone),''),
      nullif(trim(_company),''), nullif(trim(_note),''), 'shareback', c.label || ' card');
  INSERT INTO public.card_views(card_id, user_id, event_type) VALUES (c.id, c.user_id, 'shareback');
END $$;

-- A personal card other than the owner's oldest, while the owner is on free.
create or replace function public.card_is_locked(_card uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cards c
    where c.id = _card and c.org_id is null
      and public.effective_plan(c.user_id) = 'free'
      and c.id <> (select o.id from public.cards o
                   where o.user_id = c.user_id and o.org_id is null
                   order by o.created_at, o.id limit 1)
  )
$$;
revoke all on function public.card_is_locked(uuid) from public, anon, authenticated;

create or replace function public.enforce_card_edit_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare locked boolean;
begin
  -- Only end-user requests carry auth.uid(); service-role and system paths pass.
  if auth.uid() is null then return coalesce(new, old); end if;
  -- Branch per table: plpgsql can't reference card_id on a cards row.
  if tg_table_name = 'cards' then
    locked := public.card_is_locked(old.id);
  elsif tg_op = 'INSERT' then
    locked := public.card_is_locked(new.card_id);
  elsif tg_op = 'DELETE' then
    locked := public.card_is_locked(old.card_id);
  else
    locked := public.card_is_locked(old.card_id) or public.card_is_locked(new.card_id);
  end if;
  if locked then
    raise exception 'This card is locked on the free plan — upgrade to edit it' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists cards_edit_lock on public.cards;
create trigger cards_edit_lock before update on public.cards
  for each row execute function public.enforce_card_edit_lock();
drop trigger if exists card_links_edit_lock on public.card_links;
create trigger card_links_edit_lock before insert or update or delete on public.card_links
  for each row execute function public.enforce_card_edit_lock();
