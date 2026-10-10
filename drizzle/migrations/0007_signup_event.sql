-- Applied directly to the Lovable cloud database (this repo has no migration runner).
-- Allow the 'signup' event so A/B variants can be judged on accounts created,
-- not just CTA clicks.

create or replace function public.log_site_event(_event_type text, _meta text default null)
returns void language sql security definer set search_path = public
as $$
  insert into public.site_events (event_type, meta)
  select left(_event_type, 40), left(_meta, 200)
  where _event_type in ('cta_click', 'demo_click', 'pricing_view', 'signup');
$$;
