-- Applied directly to the Lovable cloud database (this repo has no migration runner).

-- Postal address captured from scanned business cards (and manual entry)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS address text;
