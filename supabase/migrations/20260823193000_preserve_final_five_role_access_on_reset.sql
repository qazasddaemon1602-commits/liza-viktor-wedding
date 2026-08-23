-- Rehearsal reset clears answers/progress, but personal couple URLs are also
-- used later by the Bunker (Liza's URL becomes her operator console). Preserve
-- active credentials so a safe test reset cannot silently invalidate a URL
-- that has already been handed to Liza or Viktor.

create or replace function public.owner_reset_event_test_data(
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
  v_run_nonce uuid;
  v_preserved_role_access jsonb := '[]'::jsonb;
begin
  perform public._require_bunker_owner(p_event_id);

  if coalesce(p_confirmation, '') <> 'СБРОСИТЬ' then
    raise exception 'explicit reset confirmation required' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'role', access.role,
        'tokenHash', access.token_hash,
        'issuedAt', access.issued_at
      )
      order by access.role
    ),
    '[]'::jsonb
  )
  into v_preserved_role_access
  from public.final_five_role_access access
  where access.event_id = p_event_id
    and access.revoked_at is null;

  perform public.owner_reset_bunker_progress(p_event_id, gen_random_uuid());

  for v_run_nonce in
    select run.run_nonce
    from public.bunker_game_runs run
    where run.event_id = p_event_id
    order by run.run_nonce
  loop
    perform public._delete_bunker_game_run(p_event_id, v_run_nonce);
  end loop;

  v_result := public._owner_reset_event_test_data_without_v2(
    p_event_id,
    p_confirmation
  );

  insert into public.final_five_role_access(
    event_id,
    role,
    token_hash,
    issued_at,
    revoked_at
  )
  select
    p_event_id,
    item->>'role',
    item->>'tokenHash',
    (item->>'issuedAt')::timestamptz,
    null
  from jsonb_array_elements(v_preserved_role_access) item
  on conflict (event_id, role) do update
  set token_hash = excluded.token_hash,
      issued_at = excluded.issued_at,
      revoked_at = null;

  return v_result || jsonb_build_object(
    'bunkerV2RunReset', true,
    'historicalBunkerRunsCleared', true,
    'personalRoleLinksPreserved', jsonb_array_length(v_preserved_role_access)
  );
end;
$$;

revoke all on function public.owner_reset_event_test_data(uuid, text)
from public, anon, authenticated;

grant execute on function public.owner_reset_event_test_data(uuid, text)
to authenticated;
