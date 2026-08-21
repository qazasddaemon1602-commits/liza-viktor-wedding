-- Supabase projects grant new public-schema functions to API roles by default.
-- Require every future RPC migration to opt in to its intended callers.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
