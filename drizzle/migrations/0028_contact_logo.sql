-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- A contact's company logo, uploaded or cropped by the owner. Lives in the
-- private card-media bucket under <user_id>/contact-photos/ like photo_path;
-- when null the app falls back to the company's favicon.
alter table public.contacts add column logo_path text;
