-- Forward-only results correction: M01-M06 are six story stages even though
-- wagon/group missions create several durable mission-instance rows.

create or replace function public._bunker_v2_mission_stage_counts(
  p_event_id uuid,
  p_run_nonce uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  with required(mission_code) as (
    values
      ('MISSION_01'::text),('MISSION_02'::text),('MISSION_03'::text),
      ('MISSION_04'::text),('MISSION_05'::text),('MISSION_06'::text)
  ), instance_counts as (
    select instance.mission_code,
      count(*)::integer as instance_count,
      count(*) filter(where instance.status='completed')::integer as completed_count
    from public.bunker_mission_instances instance
    where instance.event_id=p_event_id and instance.run_nonce=p_run_nonce
      and instance.mission_code in ('MISSION_01','MISSION_02','MISSION_03','MISSION_04','MISSION_05','MISSION_06')
    group by instance.mission_code
  )
  select jsonb_build_object(
    'completed',count(*) filter(
      where coalesce(instance_counts.instance_count,0)>0
        and instance_counts.completed_count=instance_counts.instance_count
    )::integer,
    'total',count(*)::integer
  )
  from required left join instance_counts using(mission_code);
$$;
revoke all on function public._bunker_v2_mission_stage_counts(uuid,uuid) from public,anon,authenticated;

create or replace function public.get_bunker_v2_results(p_event_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_contract integer;
  v_final public.bunker_mission_instances%rowtype;
  v_finish integer:=0; v_emergency boolean:=false;
  v_active integer:=0; v_saved integer:=0; v_excluded integer:=0;
  v_archive integer:=0; v_remaining integer:=0; v_used integer:=0; v_trades integer:=0;
  v_wrong integer:=0; v_hints integer:=0; v_skills integer:=0;
  v_missions_completed integer:=0; v_missions_total integer:=6; v_stage_counts jsonb;
  v_m06_success boolean:=false; v_final_success boolean:=false; v_coordination integer:=0;
  v_now timestamptz:=statement_timestamp();
begin
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);
  if v_event_id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;

  select s.* into v_state from public.bunker_state s where s.event_id=v_event_id;
  if v_state.run_nonce is null or v_state.global_game_state not in ('BUNKER_OPEN','FINISHED') then
    return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);
  end if;

  select r.contract_version into v_contract from public.bunker_game_runs r
  where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;
  if v_contract is distinct from 2 then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;

  select i.* into v_final from public.bunker_mission_instances i
  where i.event_id=v_event_id and i.run_nonce=v_state.run_nonce and i.mission_code='FINAL_30' limit 1;
  if v_final.id is not null then
    v_finish:=greatest(0,coalesce((v_final.outcome->>'finishTimeSeconds')::integer,0));
    v_emergency:=coalesce(v_final.outcome->>'status','')='emergency_open';
    v_final_success:=coalesce(v_final.outcome->>'status','')='success';
    v_hints:=greatest(0,coalesce((v_final.definition->>'ownerHintLevel')::integer,0));
  end if;

  select count(*) filter(where profile.character_status='active')::integer,
    count(*) filter(where profile.character_status='saved')::integer,
    count(*) filter(where profile.character_status='excluded')::integer
  into v_active,v_saved,v_excluded
  from public.bunker_guest_profiles profile
  where profile.event_id=v_event_id and profile.run_nonce=v_state.run_nonce;

  select count(distinct archive.artifact_key)::integer into v_archive
  from public.bunker_archive_entries archive
  where archive.event_id=v_event_id and archive.run_nonce=v_state.run_nonce and archive.decryption_status='decoded';

  select coalesce(sum(lot.quantity) filter(where lot.status='available'),0)::integer,
    coalesce(sum(lot.quantity) filter(where lot.status='used'),0)::integer
  into v_remaining,v_used
  from public.bunker_inventory_lots lot
  where lot.event_id=v_event_id and lot.run_nonce=v_state.run_nonce;

  select count(*)::integer into v_trades from public.bunker_inventory_transfers transfer
  where transfer.event_id=v_event_id and transfer.run_nonce=v_state.run_nonce and transfer.status='accepted';

  if v_final.id is not null then
    select count(*)::integer into v_wrong
    from public.bunker_mission_decisions decision
    where decision.instance_id=v_final.id and decision.decision_key like 'final_access_%'
      and coalesce((decision.outcome->>'success')::boolean,false)=false;
  end if;

  select count(*)::integer into v_skills from public.bunker_ability_uses ability
  where ability.event_id=v_event_id and ability.run_nonce=v_state.run_nonce and ability.status='committed';

  v_stage_counts:=public._bunker_v2_mission_stage_counts(v_event_id,v_state.run_nonce);
  v_missions_completed:=coalesce((v_stage_counts->>'completed')::integer,0);
  v_missions_total:=coalesce((v_stage_counts->>'total')::integer,6);

  select exists(select 1 from public.bunker_mission_instances instance
    where instance.event_id=v_event_id and instance.run_nonce=v_state.run_nonce
      and instance.mission_code='MISSION_06' and instance.outcome->>'status'='success')
  into v_m06_success;

  v_coordination:=greatest(0,least(100,
    case when v_missions_total>0 then round(40.0*v_missions_completed/v_missions_total)::integer else 0 end
    + case when v_m06_success then 20 else 0 end
    + least(10,v_trades*2)
    + case when v_final_success then 20 else 5 end
    + least(10,v_skills*2)
    - v_wrong*3 - v_hints*2
  ));

  return jsonb_build_object(
    'contractVersion',2,'status','completed','serverNow',v_now,
    'finishTimeSeconds',v_finish,'emergencyOpen',v_emergency,
    'characters',jsonb_build_object('active',coalesce(v_active,0),'saved',coalesce(v_saved,0),'excluded',coalesce(v_excluded,0)),
    'archiveFound',coalesce(v_archive,0),'resourcesRemaining',coalesce(v_remaining,0),'resourcesUsed',coalesce(v_used,0),
    'tradesCompleted',coalesce(v_trades,0),'wrongAttempts',coalesce(v_wrong,0),'hintsUsed',coalesce(v_hints,0),
    'skillsUsed',coalesce(v_skills,0),'missionsCompleted',coalesce(v_missions_completed,0),
    'missionsTotal',coalesce(v_missions_total,6),'coordinationScore',v_coordination
  );
end;
$$;
revoke all on function public.get_bunker_v2_results(text) from public,anon,authenticated;
grant execute on function public.get_bunker_v2_results(text) to anon,authenticated;
