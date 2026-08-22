-- Forward-only final hardening.
-- Keep the approved M05-only time formula, derive every final deadline from one
-- authoritative final_started_at, and prevent V2 final projections from masking V1.

create or replace function public._bunker_v2_final_transition()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_contract integer;
  v_instance public.bunker_mission_instances%rowtype;
  v_bonus integer:=0;
  v_now timestamptz:=clock_timestamp();
  v_started timestamptz;
begin
  if new.run_nonce is null
    or old.global_game_state is not distinct from new.global_game_state then
    return new;
  end if;

  select r.contract_version into v_contract
  from public.bunker_game_runs r
  where r.event_id=new.event_id and r.run_nonce=new.run_nonce;
  if v_contract is distinct from 2 then return new; end if;

  if new.global_game_state='FINAL_30' then
    select i.* into v_instance
    from public.bunker_mission_instances i
    where i.event_id=new.event_id
      and i.run_nonce=new.run_nonce
      and i.mission_code='FINAL_30'
    limit 1
    for update;
    if v_instance.id is null then
      raise exception 'Bunker V2 final instance missing' using errcode='55000';
    end if;

    select greatest(-300,least(600,coalesce(sum(w.route_bonus),0)::integer*60))
    into v_bonus
    from public.bunker_wagon_state w
    where w.event_id=new.event_id and w.run_nonce=new.run_nonce;

    v_started:=coalesce(new.final_started_at,v_now);

    update public.bunker_state
    set final_duration=1800+v_bonus,
        final_started_at=v_started,
        updated_at=now()
    where event_id=new.event_id;

    update public.bunker_mission_instances
    set status='active',
        started_at=coalesce(started_at,v_started),
        deadline_at=v_started+make_interval(secs=>1800+v_bonus),
        definition=definition||jsonb_build_object(
          'title','30 минут до Бункера',
          'timeAdjustmentSeconds',v_bonus,
          'ownerHintLevel',0
        )
    where id=v_instance.id;
  end if;

  return new;
end;
$$;
revoke all on function public._bunker_v2_final_transition()
  from public,anon,authenticated;

create or replace function public.get_bunker_v2_final_screen(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_contract integer;
  v_instance public.bunker_mission_instances%rowtype;
  v_progress jsonb;
  v_remaining integer;
  v_hint jsonb;
  v_now timestamptz:=clock_timestamp();
begin
  select e.id into v_event_id
  from public.events e
  where e.slug=public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now);
  end if;

  select s.* into v_state
  from public.bunker_state s
  where s.event_id=v_event_id;
  if v_state.run_nonce is null then
    return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);
  end if;

  select r.contract_version into v_contract
  from public.bunker_game_runs r
  where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;
  if v_contract is distinct from 2 then
    return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now);
  end if;

  if v_state.global_game_state not in ('FINAL_30','BUNKER_OPEN') then
    return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);
  end if;

  select i.* into v_instance
  from public.bunker_mission_instances i
  where i.event_id=v_event_id
    and i.run_nonce=v_state.run_nonce
    and i.mission_code='FINAL_30'
  limit 1;
  if v_instance.id is null then
    return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);
  end if;

  v_progress:=public._bunker_v2_final_progress(v_event_id,v_state.run_nonce);
  v_remaining:=greatest(
    0,
    extract(epoch from(coalesce(v_instance.deadline_at,v_now)-v_now))::integer
  );
  v_hint:=public._bunker_v2_final_hint(
    v_remaining,
    coalesce((v_instance.definition->>'ownerHintLevel')::integer,0)
  );

  return jsonb_build_object(
    'contractVersion',2,
    'status',case when v_state.global_game_state='BUNKER_OPEN' then 'completed' else 'active' end,
    'serverNow',v_now,
    'deadlineAt',coalesce(v_instance.deadline_at,v_now),
    'solved',(v_progress->>'solved')::integer,
    'total',(v_progress->>'total')::integer,
    'wrongAttempts',(v_progress->>'wrongAttempts')::integer,
    'unlocked',v_state.global_game_state='BUNKER_OPEN',
    'hintLevel',(v_hint->>'level')::integer,
    'timeAdjustmentSeconds',coalesce((v_instance.definition->>'timeAdjustmentSeconds')::integer,0)
  );
end;
$$;
revoke all on function public.get_bunker_v2_final_screen(text)
  from public,anon,authenticated;
grant execute on function public.get_bunker_v2_final_screen(text)
  to anon,authenticated;

create or replace function public.get_owner_bunker_v2_final(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_slug text;
begin
  perform public._require_bunker_owner(p_event_id);
  select e.slug into v_slug from public.events e where e.id=p_event_id;
  if v_slug is null then
    raise exception 'Bunker event not found' using errcode='P0002';
  end if;
  return public.get_bunker_v2_final_screen(v_slug);
end;
$$;
revoke all on function public.get_owner_bunker_v2_final(uuid)
  from public,anon,authenticated;
grant execute on function public.get_owner_bunker_v2_final(uuid)
  to authenticated;