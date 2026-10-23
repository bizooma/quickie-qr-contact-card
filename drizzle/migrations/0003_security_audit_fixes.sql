-- Security audit part 1. Based on live catalog definitions inspected 2026-10-23.
-- No existing business rows are rewritten; existing migration history is untouched.
ALTER POLICY "members insert" ON public.org_members TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'owner' AND EXISTS (
    SELECT 1 FROM public.orgs o WHERE o.id = org_members.org_id AND o.owner_id = auth.uid()));

REVOKE UPDATE ON public.orgs FROM authenticated;
GRANT UPDATE (name, accent_color, background_color, logo_path, lock_brand, share_contacts)
  ON public.orgs TO authenticated;
ALTER POLICY "org manage" ON public.orgs TO authenticated
  USING (public.org_role_of(id) IN ('owner','admin'))
  WITH CHECK (public.org_role_of(id) IN ('owner','admin'));

DROP POLICY "teammate profile select" ON public.profiles;
CREATE FUNCTION public.team_member_names(p_org uuid)
RETURNS TABLE (id uuid, display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.org_role_of(p_org) IS NULL THEN
    RAISE EXCEPTION 'Not a member of this team' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT p.id, p.display_name FROM public.profiles p
    JOIN public.org_members m ON m.user_id = p.id WHERE m.org_id = p_org;
END $$;
REVOKE EXECUTE ON FUNCTION public.team_member_names(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_member_names(uuid) TO authenticated;

REVOKE DELETE ON public.profiles FROM authenticated;
DROP POLICY "own profile delete" ON public.profiles;

-- Shared by the profile-insert and email-confirmation triggers. Lock the
-- profile and grant so retries/concurrent confirmation cannot claim twice.
CREATE FUNCTION public.claim_verified_signup_grant(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text; p public.profiles%ROWTYPE; g public.signup_grants%ROWTYPE;
  expires timestamptz; current_rank integer; grant_rank integer;
BEGIN
  SELECT lower(email) INTO e FROM auth.users
    WHERE id = p_user AND email_confirmed_at IS NOT NULL;
  IF e IS NULL THEN RETURN; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO g FROM public.signup_grants
    WHERE claimed_at IS NULL AND claimed_by IS NULL AND match_email IS NOT NULL
      AND lower(match_email) = e ORDER BY created_at, id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  current_rank := CASE p.plan WHEN 'premium' THEN 2 WHEN 'pro' THEN 1 ELSE 0 END;
  grant_rank := CASE g.plan WHEN 'premium' THEN 2 WHEN 'pro' THEN 1 ELSE 0 END;
  expires := CASE WHEN g.grant_months IS NULL THEN NULL
    ELSE now() + make_interval(months => g.grant_months) END;
  IF current_rank >= grant_rank OR
     (p.plan_expires_at IS NOT NULL AND expires IS NOT NULL AND p.plan_expires_at > expires)
    THEN RETURN; END IF;
  UPDATE public.profiles SET plan = g.plan, plan_expires_at = expires WHERE id = p_user;
  UPDATE public.signup_grants SET claimed_by = p_user, claimed_at = now()
    WHERE id = g.id AND claimed_at IS NULL AND claimed_by IS NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_verified_signup_grant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_verified_signup_grant(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_signup_grants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.claim_verified_signup_grant(NEW.id);
  RETURN NEW;
END $$;

-- Verification and row locks also protect callers other than signup.
CREATE OR REPLACE FUNCTION public.apply_purchase_entitlements(_user uuid, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.purchase_entitlements%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user
    AND lower(email) = lower(_email) AND email_confirmed_at IS NOT NULL) THEN RETURN; END IF;
  PERFORM 1 FROM public.profiles WHERE id = _user FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  FOR r IN SELECT * FROM public.purchase_entitlements
    WHERE email = lower(_email) AND applied_at IS NULL AND applied_to IS NULL AND NOT is_test
    ORDER BY CASE kind WHEN 'lifetime' THEN 0 WHEN 'year' THEN 1 ELSE 2 END, id FOR UPDATE
  LOOP
    IF r.kind = 'lifetime' THEN
      UPDATE public.profiles SET plan = 'pro', plan_expires_at = NULL
        WHERE id = _user AND plan <> 'premium';
    ELSIF r.kind = 'year' THEN
      UPDATE public.profiles SET plan = 'pro', plan_expires_at = CASE
        WHEN plan = 'pro' AND plan_expires_at IS NULL THEN NULL
        ELSE greatest(coalesce(plan_expires_at, now()), now()) + interval '1 year' END
        WHERE id = _user AND plan <> 'premium';
    ELSE
      UPDATE public.profiles SET credit_scan = credit_scan + 25,
        credit_follow_up = credit_follow_up + 25 WHERE id = _user;
    END IF;
    UPDATE public.purchase_entitlements SET applied_to = _user, applied_at = now()
      WHERE id = r.id AND applied_at IS NULL AND applied_to IS NULL;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.claim_entitlements_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text;
BEGIN
  SELECT lower(email) INTO e FROM auth.users WHERE id = NEW.id AND email_confirmed_at IS NOT NULL;
  IF e IS NOT NULL THEN PERFORM public.apply_purchase_entitlements(NEW.id, e); END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.record_app_purchase(_order_id text, _order_number bigint,
  _event text, _email text, _kind text, _amount_cents integer, _is_test boolean, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _inserted uuid;
BEGIN
  IF _kind NOT IN ('lifetime','year','starter') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad kind'); END IF;
  INSERT INTO public.purchase_entitlements
    (email, kind, pinball_order_id, order_number, amount_cents, is_test, payload)
    VALUES (lower(_email), _kind, _order_id, _order_number, _amount_cents, _is_test, _payload)
    ON CONFLICT (pinball_order_id, kind) DO NOTHING RETURNING id INTO _inserted;
  IF _is_test THEN RETURN jsonb_build_object('ok', true, 'test', true, 'granted', false); END IF;
  SELECT id INTO _uid FROM auth.users
    WHERE lower(email) = lower(_email) AND email_confirmed_at IS NOT NULL LIMIT 1;
  IF _uid IS NOT NULL THEN
    PERFORM public.apply_purchase_entitlements(_uid, _email);
    RETURN jsonb_build_object('ok', true, 'granted', true, 'replay', _inserted IS NULL);
  END IF;
  RETURN jsonb_build_object('ok', true, 'granted', false, 'pending', true, 'replay', _inserted IS NULL);
END $$;

CREATE FUNCTION public.claim_verified_benefits_on_confirm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.apply_purchase_entitlements(NEW.id, lower(NEW.email));
  PERFORM public.claim_verified_signup_grant(NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER users_claim_benefits_on_confirm AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.claim_verified_benefits_on_confirm();

REVOKE EXECUTE ON FUNCTION public.in_same_org_as(uuid), public.org_role_of(uuid),
  public.org_shares_contacts_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.in_same_org_as(uuid), public.org_role_of(uuid),
  public.org_shares_contacts_of(uuid) TO authenticated;
-- The live org-limit trigger is named enforce_org_plan, not enforce_org_limit.
-- Include every deployed SECURITY DEFINER trigger function, including new ones.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.signature);
  END LOOP;
END $$;

-- Run after cards_org_brand (triggers of the same timing run by name).
CREATE FUNCTION public.validate_card_media_paths()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE field record; prefix text := NEW.user_id::text || '/'; org_logo text;
BEGIN
  IF NEW.org_id IS NOT NULL THEN
    SELECT logo_path INTO org_logo FROM public.orgs WHERE id = NEW.org_id AND lock_brand;
  END IF;
  FOR field IN SELECT key, value FROM jsonb_each_text(to_jsonb(NEW)) WHERE key LIKE '%\_path' ESCAPE '\'
  LOOP
    IF field.value IS NULL THEN CONTINUE; END IF;
    IF field.key = 'logo_path' AND field.value = org_logo THEN CONTINUE; END IF;
    IF left(field.value, length(prefix)) <> prefix OR
       field.value ~ '(^|/)(\.{1,2})(/|$)' OR position(chr(92) IN field.value) > 0 THEN
      RAISE EXCEPTION 'Media must belong to the card owner' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_card_media_paths() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cards_validate_media_paths BEFORE INSERT OR UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.validate_card_media_paths();

CREATE FUNCTION public.validate_org_logo_path()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); prefix text;
BEGIN
  IF NEW.logo_path IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.logo_path IS NOT DISTINCT FROM OLD.logo_path THEN RETURN NEW; END IF;
  END IF;
  -- Privileged provisioning has no member JWT; scope it to the org owner.
  actor := coalesce(actor, NEW.owner_id);
  prefix := actor::text || '/';
  IF left(NEW.logo_path, length(prefix)) <> prefix OR
     NEW.logo_path ~ '(^|/)(\.{1,2})(/|$)' OR position(chr(92) IN NEW.logo_path) > 0 THEN
    RAISE EXCEPTION 'Logo must belong to the member updating the team' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_org_logo_path() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER orgs_validate_logo_path BEFORE INSERT OR UPDATE ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.validate_org_logo_path();

-- Intentionally no table grants: only SECURITY DEFINER RPCs touch this log.
CREATE TABLE public.rpc_rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash text NOT NULL,
  kind text NOT NULL,
  card_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.rpc_rate_limits FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX rpc_rate_limits_ip_time ON public.rpc_rate_limits (ip_hash, kind, created_at);
CREATE INDEX rpc_rate_limits_created ON public.rpc_rate_limits (created_at);

CREATE FUNCTION public.rpc_client_ip_hash()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE headers jsonb; ip text; salt text;
BEGIN
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  ip := coalesce(nullif(trim(headers->>'cf-connecting-ip'), ''),
    nullif(trim(split_part(headers->>'x-forwarded-for', ',', 1)), ''));
  IF ip IS NULL THEN RETURN NULL; END IF;
  -- Lazily create a random private salt, never store or return the raw IP.
  INSERT INTO public.app_secrets(key, value)
    VALUES ('rpc_rate_limit_salt', to_jsonb(encode(extensions.gen_random_bytes(32), 'hex')))
    ON CONFLICT (key) DO NOTHING;
  SELECT value #>> '{}' INTO salt FROM public.app_secrets WHERE key = 'rpc_rate_limit_salt';
  RETURN encode(extensions.digest(salt || ':' || ip, 'sha256'), 'hex');
END $$;
REVOKE EXECUTE ON FUNCTION public.rpc_client_ip_hash() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.cleanup_rpc_rate_limits()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE removed bigint;
BEGIN
  DELETE FROM public.rpc_rate_limits WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;
REVOKE EXECUTE ON FUNCTION public.cleanup_rpc_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rpc_rate_limits() TO service_role;

CREATE OR REPLACE FUNCTION public.submit_shareback(_slug text, _name text, _email text,
  _phone text, _company text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.log_card_event(_slug text, _event text, _meta text DEFAULT NULL,
  _referrer text DEFAULT NULL, _device text DEFAULT NULL, _visitor text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; recent integer; ip text;
BEGIN
  IF _event NOT IN ('view','save','click') THEN RAISE EXCEPTION 'invalid event'; END IF;
  SELECT id, user_id INTO c FROM public.cards WHERE slug = lower(_slug);
  IF c.id IS NULL THEN RETURN; END IF;
  ip := public.rpc_client_ip_hash();
  IF ip IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('events:' || ip, 0));
    SELECT count(*) INTO recent FROM public.rpc_rate_limits
      WHERE ip_hash = ip AND kind = 'event' AND created_at > now() - interval '1 hour';
    IF recent >= 120 THEN RETURN; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('event-card:' || c.id::text, 0));
  SELECT count(*) INTO recent FROM public.card_views
    WHERE card_id = c.id AND created_at > now() - interval '1 hour';
  IF recent >= 2000 THEN RETURN; END IF;
  IF ip IS NOT NULL THEN
    INSERT INTO public.rpc_rate_limits(ip_hash, kind, card_id) VALUES (ip, 'event', c.id);
  END IF;
  INSERT INTO public.card_views(card_id, user_id, event_type, meta, referrer, device, visitor)
    VALUES (c.id, c.user_id, _event, nullif(left(coalesce(_meta,''),80),''),
      nullif(left(coalesce(_referrer,''),120),''), nullif(left(coalesce(_device,''),20),''),
      nullif(left(coalesce(_visitor,''),64),''));
END $$;

CREATE OR REPLACE FUNCTION public.log_site_event(_event_type text, _meta text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent integer; ip text;
BEGIN
  IF _event_type NOT IN ('cta_click','demo_click','pricing_view','signup') THEN RETURN; END IF;
  ip := public.rpc_client_ip_hash();
  IF ip IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('events:' || ip, 0));
    SELECT count(*) INTO recent FROM public.rpc_rate_limits
      WHERE ip_hash = ip AND kind = 'event' AND created_at > now() - interval '1 hour';
    IF recent >= 120 THEN RETURN; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('site-events', 0));
  SELECT count(*) INTO recent FROM public.site_events WHERE created_at > now() - interval '1 hour';
  IF recent >= 5000 THEN RETURN; END IF;
  IF ip IS NOT NULL THEN
    INSERT INTO public.rpc_rate_limits(ip_hash, kind) VALUES (ip, 'event');
  END IF;
  INSERT INTO public.site_events(event_type, meta) VALUES (left(_event_type,40), left(_meta,200));
END $$;
-- Existing EXECUTE grants on the four public RPCs are preserved by CREATE OR REPLACE.
