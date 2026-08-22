do $migration$
begin
  if to_regprocedure(
    'public._owner_get_bunker_control_before_final_gate(uuid)'
  ) is null then
    if to_regprocedure('public.owner_get_bunker_control(uuid)') is null then
      raise exception 'owner_get_bunker_control(uuid) must exist before installing the final gate';
    end if;
    execute 'alter function public.owner_get_bunker_control(uuid) rename to _owner_get_bunker_control_before_final_gate';
  end if;
end;
$migration$;
revoke all on function public._owner_get_bunker_control_before_final_gate(uuid)
  from public, anon, authenticated;

create or replace function public.owner_get_bunker_control(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_state public.bunker_state%rowtype;
begin
  perform public._require_bunker_owner(p_event_id);
  v_result := public._owner_get_bunker_control_before_final_gate(p_event_id);

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id;

  return v_result || jsonb_build_object(
    'unlocked', coalesce(
      v_state.unlocked_at is not null
        or v_state.global_game_state in ('BUNKER_OPEN', 'FINISHED'),
      false
    )
  );
end;
$$;

do $migration$
begin
  if to_regprocedure(
    'public._owner_advance_bunker_game_state_before_final_gate(uuid,text)'
  ) is null then
    if to_regprocedure(
      'public.owner_advance_bunker_game_state(uuid,text)'
    ) is null then
      raise exception 'owner_advance_bunker_game_state(uuid,text) must exist before installing the final gate';
    end if;
    execute 'alter function public.owner_advance_bunker_game_state(uuid,text) rename to _owner_advance_bunker_game_state_before_final_gate';
  end if;
end;
$migration$;
revoke all on function public._owner_advance_bunker_game_state_before_final_gate(uuid, text)
  from public, anon, authenticated;

create or replace function public.owner_advance_bunker_game_state(
  p_event_id uuid,
  p_next_state text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
begin
  perform public._require_bunker_owner(p_event_id);

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;

  if p_next_state = 'BUNKER_OPEN'
    and v_state.global_game_state = 'FINAL_30'
    and v_state.unlocked_at is null then
    raise exception 'Bunker final code must unlock before opening'
      using errcode = '55000';
  end if;

  return public._owner_advance_bunker_game_state_before_final_gate(
    p_event_id,
    p_next_state
  );
end;
$$;

create or replace function public.owner_force_open_bunker(
  p_event_id uuid,
  p_reason text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_result jsonb;
begin
  perform public._require_bunker_owner(p_event_id);

  if char_length(v_reason) < 12 then
    raise exception 'recovery reason must contain at least 12 characters'
      using errcode = '22023';
  end if;
  if p_confirmation is distinct from 'ОТКРЫТЬ БУНКЕР ПРИНУДИТЕЛЬНО' then
    raise exception 'invalid forced Bunker confirmation'
      using errcode = '22023';
  end if;

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;

  if v_state.event_id is null
    or v_state.status <> 'active'
    or v_state.global_game_state <> 'FINAL_30' then
    raise exception 'forced Bunker opening is available only during FINAL_30'
      using errcode = '55000';
  end if;
  if v_state.unlocked_at is not null then
    raise exception 'Bunker final is already unlocked'
      using errcode = '55000';
  end if;

  update public.bunker_state
  set unlocked_at = clock_timestamp(),
      updated_at = now()
  where event_id = p_event_id;

  v_result := public.owner_advance_bunker_game_state(
    p_event_id,
    'BUNKER_OPEN'
  );

  insert into public.owner_action_log(
    event_id,
    owner_user_id,
    action,
    payload
  ) values (
    p_event_id,
    auth.uid(),
    'bunker_force_open_recovery',
    jsonb_build_object(
      'reason', v_reason,
      'previousState', v_state.global_game_state,
      'globalGameState', 'BUNKER_OPEN',
      'runNonce', v_state.run_nonce
    )
  );

  return v_result || jsonb_build_object(
    'forced', true,
    'unlocked', true
  );
end;
$$;

revoke all on function public.owner_get_bunker_control(uuid)
  from public, anon, authenticated;
revoke all on function public.owner_advance_bunker_game_state(uuid, text)
  from public, anon, authenticated;
revoke all on function public.owner_force_open_bunker(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.owner_get_bunker_control(uuid)
  to authenticated;
grant execute on function public.owner_advance_bunker_game_state(uuid, text)
  to authenticated;
grant execute on function public.owner_force_open_bunker(uuid, text, text)
  to authenticated;
