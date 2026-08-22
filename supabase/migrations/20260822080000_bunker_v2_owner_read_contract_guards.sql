-- Keep owner read models on the exact same V1/V2 contract boundary as the
-- corresponding public TV projections. M02 keeps its owner-only hintsUsed
-- metric, so it performs the contract guard locally; later stages delegate.

create or replace function public.get_owner_bunker_v2_m02(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.bunker_state%rowtype;
  v_contract integer;
  v_deadline timestamptz;
  v_wagons jsonb;
  v_now timestamptz := clock_timestamp();
begin
  perform public._require_bunker_owner(p_event_id);
  select state.* into v_state
  from public.bunker_state state
  where state.event_id = p_event_id;
  if v_state.run_nonce is null then
    return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);
  end if;

  select run.contract_version into v_contract
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = v_state.run_nonce;
  if v_contract is distinct from 2 then
    return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now);
  end if;

  select
    max(instance.deadline_at),
    jsonb_agg(jsonb_build_object(
      'wagonId',instance.scope_key,
      'label',carriage.label,
      'status',case when instance.status='completed' then 'completed' else 'active' end,
      'attemptCount',(
        select count(*)
        from public.bunker_mission_decisions decision
        where decision.instance_id=instance.id
          and decision.decision_key like 'm02_answer_%'
      ),
      'hintsUsed',(
        select count(*)
        from public.bunker_ability_uses ability_use
        where ability_use.instance_id=instance.id
          and ability_use.status='committed'
      )
    ) order by carriage.number)
  into v_deadline, v_wagons
  from public.bunker_mission_instances instance
  join public.carriages carriage
    on carriage.id::text=instance.scope_key
   and carriage.event_id=p_event_id
  where instance.run_nonce=v_state.run_nonce
    and instance.mission_code='MISSION_02';

  return jsonb_build_object(
    'contractVersion',2,
    'status',case when v_state.global_game_state='MISSION_02' then 'active' else 'completed' end,
    'serverNow',v_now,
    'deadlineAt',coalesce(v_deadline,v_now),
    'title','Чёрный ящик',
    'wagons',coalesce(v_wagons,'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_owner_bunker_v2_m03(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  perform public._require_bunker_owner(p_event_id);
  select event.slug into v_slug from public.events event where event.id = p_event_id;
  if v_slug is null then raise exception 'Bunker event not found' using errcode = 'P0002'; end if;
  return public.get_bunker_v2_m03_screen(v_slug);
end;
$$;

create or replace function public.get_owner_bunker_v2_m04(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  perform public._require_bunker_owner(p_event_id);
  select event.slug into v_slug from public.events event where event.id = p_event_id;
  if v_slug is null then raise exception 'Bunker event not found' using errcode = 'P0002'; end if;
  return public.get_bunker_v2_m04_screen(v_slug);
end;
$$;

create or replace function public.get_owner_bunker_v2_m05(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  perform public._require_bunker_owner(p_event_id);
  select event.slug into v_slug from public.events event where event.id = p_event_id;
  if v_slug is null then raise exception 'Bunker event not found' using errcode = 'P0002'; end if;
  return public.get_bunker_v2_m05_screen(v_slug);
end;
$$;

create or replace function public.get_owner_bunker_v2_m06(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  perform public._require_bunker_owner(p_event_id);
  select event.slug into v_slug from public.events event where event.id = p_event_id;
  if v_slug is null then raise exception 'Bunker event not found' using errcode = 'P0002'; end if;
  return public.get_bunker_v2_m06_screen(v_slug);
end;
$$;

create or replace function public.get_owner_bunker_v2_unknown_passenger(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  perform public._require_bunker_owner(p_event_id);
  select event.slug into v_slug from public.events event where event.id = p_event_id;
  if v_slug is null then raise exception 'Bunker event not found' using errcode = 'P0002'; end if;
  return public.get_bunker_v2_unknown_passenger_screen(v_slug);
end;
$$;

revoke all on function public.get_owner_bunker_v2_m02(uuid) from public, anon, authenticated;
revoke all on function public.get_owner_bunker_v2_m03(uuid) from public, anon, authenticated;
revoke all on function public.get_owner_bunker_v2_m04(uuid) from public, anon, authenticated;
revoke all on function public.get_owner_bunker_v2_m05(uuid) from public, anon, authenticated;
revoke all on function public.get_owner_bunker_v2_m06(uuid) from public, anon, authenticated;
revoke all on function public.get_owner_bunker_v2_unknown_passenger(uuid) from public, anon, authenticated;

grant execute on function public.get_owner_bunker_v2_m02(uuid) to authenticated;
grant execute on function public.get_owner_bunker_v2_m03(uuid) to authenticated;
grant execute on function public.get_owner_bunker_v2_m04(uuid) to authenticated;
grant execute on function public.get_owner_bunker_v2_m05(uuid) to authenticated;
grant execute on function public.get_owner_bunker_v2_m06(uuid) to authenticated;
grant execute on function public.get_owner_bunker_v2_unknown_passenger(uuid) to authenticated;
