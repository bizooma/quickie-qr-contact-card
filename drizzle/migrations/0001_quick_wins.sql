-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Recorded here so the schema history stays readable.

-- PR #6: headshot cropped from a scanned business card
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS photo_path text;

-- Link-click events with an optional label (which link was tapped)
ALTER TABLE public.card_views DROP CONSTRAINT IF EXISTS card_views_event_type_check;
ALTER TABLE public.card_views ADD CONSTRAINT card_views_event_type_check
  CHECK (event_type IN ('view','save','shareback','click'));
ALTER TABLE public.card_views ADD COLUMN IF NOT EXISTS meta text;

DROP FUNCTION IF EXISTS public.log_card_event(text, text);
CREATE OR REPLACE FUNCTION public.log_card_event(_slug text, _event text, _meta text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF _event NOT IN ('view','save','click') THEN RAISE EXCEPTION 'invalid event'; END IF;
  IF length(COALESCE(_meta,'')) > 80 THEN _meta := left(_meta, 80); END IF;
  SELECT id, user_id INTO c FROM public.cards WHERE slug = lower(_slug);
  IF c.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.card_views(card_id, user_id, event_type, meta)
  VALUES (c.id, c.user_id, _event, NULLIF(trim(_meta),''));
END $$;
REVOKE ALL ON FUNCTION public.log_card_event(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_card_event(text, text, text) TO anon, authenticated;

-- Per-card Open Graph image + "new leads since last visit" tracking
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS og_path text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contacts_seen_at timestamptz NOT NULL DEFAULT now();

-- get_public_card now also returns og_path (full body in 0000, only the key list changed)
