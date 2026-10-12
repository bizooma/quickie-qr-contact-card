-- Least privilege (applied live on 2026-10-11; this file is the record).
-- The architecture routes all anon access through SECURITY DEFINER RPCs,
-- but Supabase's default grants gave anon full DML plus TRUNCATE on every
-- table (blocked only by RLS, and TRUNCATE isn't subject to RLS at all —
-- just unreachable via PostgREST). Make the grants match the architecture:
-- anon gets nothing; authenticated keeps RLS-governed DML only.

revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
