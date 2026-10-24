-- Preserve the inspected hashing/salt logic and all existing RPC limits/grants.
-- Server-mediated calls must not count the app server as the visitor.
CREATE OR REPLACE FUNCTION public.rpc_client_ip_hash()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE headers jsonb; ip text; salt text;
BEGIN
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  IF auth.role() = 'service_role' THEN
    -- Only the privileged server may supply this request-scoped identity.
    -- Missing/empty means skip per-IP checks, including older app deployments.
    ip := nullif(trim(headers->>'x-contactkickstart-visitor-ip'), '');
  ELSE
    -- Browser-to-RPC traffic retains its original network-header identity.
    -- Never trust the custom identity header from anon/authenticated callers.
    ip := coalesce(nullif(trim(headers->>'cf-connecting-ip'), ''),
      nullif(trim(split_part(headers->>'x-forwarded-for', ',', 1)), ''));
  END IF;
  IF ip IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.app_secrets(key, value)
    VALUES ('rpc_rate_limit_salt', to_jsonb(encode(extensions.gen_random_bytes(32), 'hex')))
    ON CONFLICT (key) DO NOTHING;
  SELECT value #>> '{}' INTO salt FROM public.app_secrets WHERE key = 'rpc_rate_limit_salt';
  RETURN encode(extensions.digest(salt || ':' || ip, 'sha256'), 'hex');
END $$;
-- CREATE OR REPLACE preserves the existing restricted EXECUTE grants.
