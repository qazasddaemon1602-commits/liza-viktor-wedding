-- Forward-only server-authoritative timer enforcement.
-- The global state stays under owner control, but once a mission deadline has
-- elapsed no new guest command may mutate that mission. An already accepted
-- idempotent retry is still returned before this guard runs.

create or replace function public._bunker_v2_lock_command_instance(
  p_event_id uuid,
  p_run_nonce uuid,
  p_global_state text,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_instance_id uuid;
  v_instance public.bunker_mission_instances%rowtype;
begin
  if p_global_state in (
    'MISSION_01','MISSION_02','MISSION_03',
    'MISSION_04','MISSION_05','MISSION_06'
  ) then
    begin
      v_instance_id := (p_payload->>'instanceId')::uuid;
    exception when invalid_text_representation then
      return null;
    end;

    select instance.*
    into v_instance
    from public.bunker_mission_instances instance
    where instance.id = v_instance_id
      and instance.event_id = p_event_id
      and instance.run_nonce = p_run_nonce
      and instance.mission_code = p_global_state
    for update;
  elsif p_global_state = 'FINAL_30' then
    select instance.*
    into v_instance
    from public.bunker_mission_instances instance
    where instance.event_id = p_event_id
      and instance.run_nonce = p_run_nonce
      and instance.mission_code = 'FINAL_30'
    limit 1
    for update;
    v_instance_id := v_instance.id;
  else
    return null;
  end if;

  if v_instance.id is null then
    return v_instance_id;
  end if;

  if v_instance.deadline_at is not null
    and clock_timestamp() >= v_instance.deadline_at then
    raise exception 'Bunker mission deadline has expired' using errcode = '55000';
  end if;

  return v_instance.id;
end;
$$;

revoke all on function public._bunker_v2_lock_command_instance(uuid,uuid,text,jsonb)
  from public,anon,authenticated;

create or replace function public.submit_bunker_command(
  p_event_slug text,
  p_device_key text,
  p_command_id uuid,
  p_command_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_event_id uuid;
  v_guest_id uuid;
  v_state public.bunker_state%rowtype;
  v_existing public.bunker_command_receipts%rowtype;
  v_hash text;
  v_instance_id uuid;
begin
  select e.id into v_event_id
  from public.events e
  where e.slug=public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    raise exception 'Bunker event not found' using errcode='P0002';
  end if;

  v_guest_id:=public._bunker_guest_id(p_event_slug,p_device_key);
  if v_guest_id is null then
    raise exception 'registered Bunker guest required' using errcode='42501';
  end if;

  select s.* into v_state
  from public.bunker_state s
  where s.event_id=v_event_id
  for update;
  if v_state.run_nonce is null then
    raise exception 'active Bunker V2 run required' using errcode='55000';
  end if;

  v_hash:=encode(extensions.digest(convert_to(
    jsonb_build_object('commandType',p_command_type,'payload',p_payload)::text,
    'UTF8'
  ),'sha256'),'hex');

  select receipt.* into v_existing
  from public.bunker_command_receipts receipt
  where receipt.run_nonce=v_state.run_nonce
    and receipt.actor_kind='guest'
    and receipt.actor_id=v_guest_id
    and receipt.command_id=p_command_id;

  if v_existing.id is not null then
    if v_existing.request_hash<>v_hash then
      raise exception 'idempotency_conflict' using errcode='55000';
    end if;
    return v_existing.result;
  end if;

  v_instance_id := public._bunker_v2_lock_command_instance(
    v_event_id,
    v_state.run_nonce,
    v_state.global_game_state,
    p_payload
  );

  if v_state.global_game_state='MISSION_01' then
    perform 1
    from public.bunker_mission_members member
    where member.instance_id=v_instance_id
    order by member.id
    for update;
    return public._submit_bunker_command_m01(
      p_event_slug,p_device_key,p_command_id,p_command_type,p_payload
    );
  elsif v_state.global_game_state='MISSION_02' then
    return public._submit_bunker_command_m02(
      p_event_slug,p_device_key,p_command_id,p_command_type,p_payload
    );
  elsif v_state.global_game_state='MISSION_03' then
    return public._submit_bunker_command_m03(
      p_event_slug,p_device_key,p_command_id,p_command_type,p_payload
    );
  elsif v_state.global_game_state='MISSION_04' then
    return public._submit_bunker_command_m04(
      p_event_slug,p_device_key,p_command_id,p_command_type,p_payload
    );
  elsif v_state.global_game_state='MISSION_05' then
    return public._submit_bunker_command_m05(
      p_event_slug,p_device_key,p_command_id,p_command_type,p_payload
    );
  elsif v_state.global_game_state='MISSION_06' then
    return public._submit_bunker_command_m06(
      p_event_slug,p_device_key,p_command_id,p_command_type,p_payload
    );
  elsif v_state.global_game_state='FINAL_30' then
    return public._submit_bunker_command_final(
      p_event_slug,p_device_key,p_command_id,p_command_type,p_payload
    );
  end if;

  raise exception 'Bunker command unavailable at current stage' using errcode='55000';
end;
$$;

revoke all on function public.submit_bunker_command(text,text,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.submit_bunker_command(text,text,uuid,text,jsonb)
  to anon,authenticated;
