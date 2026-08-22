-- Forward-only full-reset hardening.
-- Preserve the established global rehearsal cleanup, but tear down the current
-- Bunker V2 run through the idempotent progress-reset path first.

alter function public.owner_reset_event_test_data(uuid, text)
  rename to _owner_reset_event_test_data_without_v2;

revoke all on function public._owner_reset_event_test_data_without_v2(uuid, text)
  from public, anon, authenticated;

create function public.owner_reset_event_test_data(
  p_event_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public._require_bunker_owner(p_event_id);

  if coalesce(p_confirmation, '') <> 'СБРОСИТЬ' then
    raise exception 'explicit reset confirmation required' using errcode = '22023';
  end if;

  perform public.owner_reset_bunker_progress(p_event_id, gen_random_uuid());
  v_result := public._owner_reset_event_test_data_without_v2(
    p_event_id,
    p_confirmation
  );

  return v_result || jsonb_build_object('bunkerV2RunReset', true);
end;
$$;

revoke all on function public.owner_reset_event_test_data(uuid, text)
  from public, anon, authenticated;
grant execute on function public.owner_reset_event_test_data(uuid, text)
  to authenticated;
