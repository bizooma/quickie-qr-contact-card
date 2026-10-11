-- Flood guards on the three public SECURITY DEFINER RPCs (applied live on
-- 2026-10-11; this file is the record). Limits are generous for real use
-- and fatal for bots:
--   submit_shareback  — max 30 share-backs per card per hour (hard error)
--   log_card_event    — max 2000 events per card per hour (silent drop)
--   log_site_event    — max 5000 site events per hour (silent drop)

create or replace function public.submit_shareback(_slug text, _name text, _email text, _phone text, _company text, _note text)
returns void language plpgsql security definer set search_path to 'public' as $function$
DECLARE c record; recent int;
BEGIN
  IF _name IS NULL OR length(trim(_name)) = 0 OR length(_name) > 120 THEN RAISE EXCEPTION 'name required'; END IF;
  IF (COALESCE(trim(_email),'') = '' AND COALESCE(trim(_phone),'') = '') THEN RAISE EXCEPTION 'email or phone required'; END IF;
  IF length(COALESCE(_email,'')) > 255 OR length(COALESCE(_phone,'')) > 40 OR length(COALESCE(_company,'')) > 120 OR length(COALESCE(_note,'')) > 1000 THEN
    RAISE EXCEPTION 'input too long'; END IF;
  SELECT id, user_id, label INTO c FROM public.cards WHERE slug = lower(_slug);
  IF c.id IS NULL THEN RAISE EXCEPTION 'card not found'; END IF;
  -- Flood guard: generous for real events, fatal for bots.
  SELECT count(*) INTO recent FROM public.contacts
    WHERE card_id = c.id AND source = 'shareback' AND created_at > now() - interval '1 hour';
  IF recent >= 30 THEN RAISE EXCEPTION 'Too many submissions for this card right now — try again soon'; END IF;
  INSERT INTO public.contacts(user_id, card_id, full_name, email, phone, company, note, source, met_at)
  VALUES (c.user_id, c.id, trim(_name), NULLIF(trim(_email),''), NULLIF(trim(_phone),''), NULLIF(trim(_company),''), NULLIF(trim(_note),''), 'shareback', c.label || ' card');
  INSERT INTO public.card_views(card_id, user_id, event_type) VALUES (c.id, c.user_id, 'shareback');
END $function$;

create or replace function public.log_card_event(_slug text, _event text, _meta text default null, _referrer text default null, _device text default null, _visitor text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare c record; recent int;
begin
  if _event not in ('view','save','click') then raise exception 'invalid event'; end if;
  select id, user_id into c from public.cards where slug = lower(_slug);
  if c.id is null then return; end if;
  -- Flood guard: drop silently past 2000 events/hour per card. A viral card
  -- stays well under this; a bot loop doesn't get to inflate analytics.
  select count(*) into recent from public.card_views
    where card_id = c.id and created_at > now() - interval '1 hour';
  if recent >= 2000 then return; end if;
  insert into public.card_views(card_id, user_id, event_type, meta, referrer, device, visitor)
  values (c.id, c.user_id, _event,
          nullif(left(coalesce(_meta,''), 80), ''),
          nullif(left(coalesce(_referrer,''), 120), ''),
          nullif(left(coalesce(_device,''), 20), ''),
          nullif(left(coalesce(_visitor,''), 64), ''));
end $function$;

create or replace function public.log_site_event(_event_type text, _meta text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare recent int;
begin
  if _event_type not in ('cta_click', 'demo_click', 'pricing_view', 'signup') then return; end if;
  select count(*) into recent from public.site_events where created_at > now() - interval '1 hour';
  if recent >= 5000 then return; end if;
  insert into public.site_events (event_type, meta) values (left(_event_type, 40), left(_meta, 200));
end $function$;

create index if not exists site_events_created_idx on public.site_events (created_at);
