-- Admin analytics: distinct active users over the 30-day window (applied
-- live on 2026-10-13; this file is the record). The "Active users" card
-- used to sum the per-day distinct counts, so anyone active on several
-- days was counted once per day. The daily series stays for the sparkline;
-- the card shows active_users_total.

create or replace function public.admin_analytics()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
with days as (select generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day')::date d)
select jsonb_build_object(
  'signups', (select jsonb_agg(jsonb_build_object('d', d, 'n', coalesce(n,0)) order by d) from days
    left join (select created_at::date cd, count(*) n from auth.users where created_at > now() - interval '30 days' group by 1) s on s.cd = days.d),
  'active_users', (select jsonb_agg(jsonb_build_object('d', d, 'n', coalesce(n,0)) order by d) from days
    left join (select created_at::date cd, count(distinct user_id) n from public.user_activity where created_at > now() - interval '30 days' group by 1) s on s.cd = days.d),
  'active_users_total', (select count(distinct user_id) from public.user_activity where created_at > now() - interval '30 days'),
  'card_views', (select jsonb_agg(jsonb_build_object('d', d, 'n', coalesce(n,0)) order by d) from days
    left join (select created_at::date cd, count(*) n from public.card_views where event_type = 'view' and created_at > now() - interval '30 days' group by 1) s on s.cd = days.d),
  'sharebacks', (select jsonb_agg(jsonb_build_object('d', d, 'n', coalesce(n,0)) order by d) from days
    left join (select created_at::date cd, count(*) n from public.card_views where event_type = 'shareback' and created_at > now() - interval '30 days' group by 1) s on s.cd = days.d),
  'ai_calls', (select jsonb_agg(jsonb_build_object('d', d, 'n', coalesce(n,0)) order by d) from days
    left join (select created_at::date cd, count(*) n from public.ai_usage where created_at > now() - interval '30 days' group by 1) s on s.cd = days.d),
  'top_cards', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select c.slug, c.label, u.email as owner_email, count(*) as views
      from public.card_views v join public.cards c on c.id = v.card_id join auth.users u on u.id = c.user_id
      where v.created_at > now() - interval '30 days' and v.event_type = 'view'
      group by c.slug, c.label, u.email order by views desc limit 10) r), '[]'::jsonb),
  'site_events30', coalesce((select jsonb_object_agg(event_type, n) from (
      select event_type, count(*) n from public.site_events where created_at > now() - interval '30 days' group by 1) q), '{}'::jsonb)
)
$function$;

-- Security fix: 0016 revoked EXECUTE from anon and authenticated, but
-- Postgres also grants EXECUTE on new functions to PUBLIC, which both
-- roles inherit, so this SECURITY DEFINER function (it returns owner
-- emails) stayed callable through PostgREST. Revoke PUBLIC too; the admin
-- server function calls it with the service role, which keeps its grant.
revoke execute on function public.admin_analytics() from public, anon, authenticated;
