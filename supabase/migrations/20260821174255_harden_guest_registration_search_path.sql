-- The function body already qualifies every application relation and helper.
-- Harden only its runtime namespace without changing registration behavior.
alter function public.register_guest(
  text, text, text, text, text, text, boolean
) set search_path = '';

-- Restate the existing API surface explicitly for the forward security gate.
revoke all on function public.register_guest(
  text, text, text, text, text, text, boolean
) from public;
grant execute on function public.register_guest(
  text, text, text, text, text, text, boolean
) to anon, authenticated;
