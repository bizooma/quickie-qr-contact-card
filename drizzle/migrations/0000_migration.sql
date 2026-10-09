
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT 'Work',
  full_name text NOT NULL DEFAULT '',
  job_title text,
  company text,
  phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  website text,
  location text,
  bio text,
  headshot_path text,
  logo_path text,
  accent_color text NOT NULL DEFAULT '#E8553D',
  background_color text NOT NULL DEFAULT '#FFFFFF',
  font text NOT NULL DEFAULT 'sans',
  template text NOT NULL DEFAULT 'classic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,48}$')
);
CREATE INDEX cards_user_idx ON public.cards(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards all" ON public.cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER cards_touch BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.card_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'link',
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_links_card_idx ON public.card_links(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_links TO authenticated;
GRANT ALL ON public.card_links TO service_role;
ALTER TABLE public.card_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own links all" ON public.card_links FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.cards c WHERE c.id = card_id AND c.user_id = auth.uid()));

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  company text,
  job_title text,
  note text,
  met_at text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contacts_user_idx ON public.contacts(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts all" ON public.contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER contacts_touch BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_notes_contact_idx ON public.contact_notes(contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_notes TO authenticated;
GRANT ALL ON public.contact_notes TO service_role;
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes all" ON public.contact_notes FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.user_id = auth.uid()));

CREATE TABLE public.contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, tag)
);
CREATE INDEX contact_tags_user_idx ON public.contact_tags(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_tags TO authenticated;
GRANT ALL ON public.contact_tags TO service_role;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tags all" ON public.contact_tags FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.user_id = auth.uid()));

CREATE TABLE public.card_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'view' CHECK (event_type IN ('view','save','shareback')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_views_card_idx ON public.card_views(card_id, created_at);
GRANT SELECT, DELETE ON public.card_views TO authenticated;
GRANT ALL ON public.card_views TO service_role;
ALTER TABLE public.card_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own views select" ON public.card_views FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own views delete" ON public.card_views FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_public_card(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'slug', c.slug, 'label', c.label, 'full_name', c.full_name, 'job_title', c.job_title, 'company', c.company,
    'phones', c.phones, 'emails', c.emails, 'website', c.website, 'location', c.location, 'bio', c.bio,
    'headshot_path', c.headshot_path, 'logo_path', c.logo_path, 'accent_color', c.accent_color,
    'background_color', c.background_color, 'font', c.font, 'template', c.template,
    'links', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url, 'icon', l.icon) ORDER BY l.position, l.created_at)
                       FROM public.card_links l WHERE l.card_id = c.id), '[]'::jsonb))
  FROM public.cards c WHERE c.slug = lower(_slug);
$$;

CREATE OR REPLACE FUNCTION public.log_card_event(_slug text, _event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF _event NOT IN ('view','save') THEN RAISE EXCEPTION 'invalid event'; END IF;
  SELECT id, user_id INTO c FROM public.cards WHERE slug = lower(_slug);
  IF c.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.card_views(card_id, user_id, event_type) VALUES (c.id, c.user_id, _event);
END $$;

CREATE OR REPLACE FUNCTION public.submit_shareback(_slug text, _name text, _email text, _phone text, _company text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF _name IS NULL OR length(trim(_name)) = 0 OR length(_name) > 120 THEN RAISE EXCEPTION 'name required'; END IF;
  IF (COALESCE(trim(_email),'') = '' AND COALESCE(trim(_phone),'') = '') THEN RAISE EXCEPTION 'email or phone required'; END IF;
  IF length(COALESCE(_email,'')) > 255 OR length(COALESCE(_phone,'')) > 40 OR length(COALESCE(_company,'')) > 120 OR length(COALESCE(_note,'')) > 1000 THEN
    RAISE EXCEPTION 'input too long'; END IF;
  SELECT id, user_id, label INTO c FROM public.cards WHERE slug = lower(_slug);
  IF c.id IS NULL THEN RAISE EXCEPTION 'card not found'; END IF;
  INSERT INTO public.contacts(user_id, card_id, full_name, email, phone, company, note, source, met_at)
  VALUES (c.user_id, c.id, trim(_name), NULLIF(trim(_email),''), NULLIF(trim(_phone),''), NULLIF(trim(_company),''), NULLIF(trim(_note),''), 'shareback', c.label || ' card');
  INSERT INTO public.card_views(card_id, user_id, event_type) VALUES (c.id, c.user_id, 'shareback');
END $$;

REVOKE ALL ON FUNCTION public.get_public_card(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_card_event(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_shareback(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_card(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_card_event(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_shareback(text, text, text, text, text, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- card-media: private bucket; card images are meant to be shown publicly, so anyone may read (sign URLs) but only owners write into their own folder
CREATE POLICY "card-media read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'card-media');
CREATE POLICY "card-media owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'card-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "card-media owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'card-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "card-media owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'card-media' AND (storage.foldername(name))[1] = auth.uid()::text);
