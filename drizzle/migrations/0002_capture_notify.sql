-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Recorded here so the schema history stays readable.

-- Web-push subscriptions (owner-scoped)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subs" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Server-only secrets (RLS enabled with no policies: service role only).
-- Holds the self-provisioned VAPID keypair under key 'vapid'.
CREATE TABLE IF NOT EXISTS public.app_secrets (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.app_secrets FROM anon, authenticated;
GRANT ALL ON public.app_secrets TO service_role;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

-- Outbound webhook target per user
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS webhook_url text;

-- Analytics depth on views: hostname referrer, coarse device, anonymous visitor id
ALTER TABLE public.card_views ADD COLUMN IF NOT EXISTS referrer text;
ALTER TABLE public.card_views ADD COLUMN IF NOT EXISTS device text;
ALTER TABLE public.card_views ADD COLUMN IF NOT EXISTS visitor text;

DROP FUNCTION IF EXISTS public.log_card_event(text, text, text);
CREATE OR REPLACE FUNCTION public.log_card_event(
  _slug text, _event text, _meta text DEFAULT NULL,
  _referrer text DEFAULT NULL, _device text DEFAULT NULL, _visitor text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF _event NOT IN ('view','save','click') THEN RAISE EXCEPTION 'invalid event'; END IF;
  SELECT id, user_id INTO c FROM public.cards WHERE slug = lower(_slug);
  IF c.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.card_views(card_id, user_id, event_type, meta, referrer, device, visitor)
  VALUES (c.id, c.user_id, _event,
          NULLIF(left(COALESCE(_meta,''), 80), ''),
          NULLIF(left(COALESCE(_referrer,''), 120), ''),
          NULLIF(left(COALESCE(_device,''), 20), ''),
          NULLIF(left(COALESCE(_visitor,''), 64), ''));
END $$;
REVOKE ALL ON FUNCTION public.log_card_event(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_card_event(text, text, text, text, text, text) TO anon, authenticated;

-- The share-back server function calls these with the service role
GRANT EXECUTE ON FUNCTION public.submit_shareback(text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_card_event(text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_card(text) TO service_role;
