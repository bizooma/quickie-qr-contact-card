-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Share-back limits per visitor network, raised for events. A venue's Wi-Fi
-- puts every attendee behind one address, so the old limit of 5 share-backs
-- per card per hour from one network turned people away at a busy stand.
--   per card, per network, per hour:   5 -> 30
--   all cards, per network, per hour: 20 -> 60  (it has to sit above the per-card limit)
-- Unchanged: 300 per card per hour from anywhere, the free plan's total of
-- 5, the field length checks, and who may call the function.

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
    IF recent >= 60 OR (SELECT count(*) FROM public.rpc_rate_limits WHERE ip_hash = ip
      AND kind = 'shareback' AND card_id = c.id AND created_at > now() - interval '1 hour') >= 30 THEN
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
