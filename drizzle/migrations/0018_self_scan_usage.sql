-- Own-card scans ("Scan my business card", all plans) are metered under
-- their own kind so they never consume the monthly scan allowance; a
-- rolling 10-per-day cap in usage.server.ts reads these rows.
-- Applied live on 2026-10-12; this file is the record.

alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check
  check (kind = any (array['scan', 'enrich', 'follow_up', 'summarize', 'self_scan']));
