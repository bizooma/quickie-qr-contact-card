-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Recorded here so the schema history stays readable.

-- Plans and Stripe linkage
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free','pro'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- One row per metered AI action; monthly counts gate the free plan
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('scan','enrich','follow_up','summarize')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_user_time_idx ON public.ai_usage(user_id, created_at DESC);
GRANT SELECT ON public.ai_usage TO authenticated; -- inserts happen with the service role only
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own usage select" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Card count ceiling per plan, enforced at the database so no client can bypass it
CREATE OR REPLACE FUNCTION public.enforce_card_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text; n int; lim int;
BEGIN
  SELECT plan INTO p FROM public.profiles WHERE id = NEW.user_id;
  lim := CASE WHEN p = 'pro' THEN 50 ELSE 1 END;
  SELECT count(*) INTO n FROM public.cards WHERE user_id = NEW.user_id;
  IF n >= lim THEN
    RAISE EXCEPTION 'Card limit reached — upgrade to Pro to create more cards';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cards_limit ON public.cards;
CREATE TRIGGER cards_limit BEFORE INSERT ON public.cards FOR EACH ROW EXECUTE FUNCTION public.enforce_card_limit();

-- (The founder account was set to plan='pro' directly.)
