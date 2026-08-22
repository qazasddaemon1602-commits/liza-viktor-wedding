-- Public, non-secret summary shown only after the Bunker has opened.
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
  v_finish integer := 0;
  v_emergency boolean := false;
  v_active integer := 0;
  v_saved integer := 0;
  v_excluded integer := 0;
  v_archive integer := 0;
  v_remaining integer := 0;
  v_used integer := 0;
  v_trades integer := 0;
  v_wrong integer := 0;
  v_hints integer := 0;
  v_skills integer := 0;
  v_missions_completed integer := 0;
  v_missions_total integer := 0;
  v_m06_success boolean := false;
  v_final_success boolean := false;
  v_coordination integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now);
  end if;

  select s.* into v_state
  from public.bunker_state s
  where s.event_id=v_event_id;

  if v_state.run_nonce is null
    or v_state.global_game_state not in ('BUNKER_OPEN','FINISHED') then
    return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);
  end if;

  select r.contract_version into v_contract
  from public.bunker_game_runs r
  where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;

  if v_contract is distinct from 2 then
    return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);
  end if;

  select i.* into v_final
  from public.bunker_mission_instances i
  where i.event_id=v_event_id
    and i.run_nonce=v_state.run_nonce
    and i.mission_code='FINAL_30'
  limit 1;

  if v_final.id is not null then
    v_finish := greatest(0,coalesce((v_final.outcome->>'finishTimeSeconds')::integer,0));
    v_emergency := coalesce(v_final.outcome->>'status','')='emergency_open';
    v_final_success := coalesce(v_final.outcome->>'status','')='success';
    v_hints := greatest(0,coalesce((v_final.definition->>'ownerHintLevel')::integer,0));
  end if;

  select
    count(*) filter(where p.status='active')::integer,
    count(*) filter(where p.status='saved')::integer,
    count(*) filter(where p.status='excluded')::integer
  into v_active,v_saved,v_excluded
  from public.bunker_guest_profiles p
  where p.event_id=v_event_id and p.run_nonce=v_state.run_nonce;

  select count(distinct a.artifact_key)::integer into v_archive
  from public.bunker_archive_entries a
  where a.event_id=v_event_id
    and a.run_nonce=v_state.run_nonce
    and a.decryption_status='decoded';

  select
    coalesce(sum(l.quantity) filter(where l.status='available'),0)::integer,
    coalesce(sum(l.quantity) filter(where l.status='used'),0)::integer
  into v_remaining,v_used
  from public.bunker_inventory_lots l
  where l.event_id=v_event_id and l.run_nonce=v_state.run_nonce;

  select count(*)::integer into v_trades
  from public.bunker_inventory_transfers t
  where t.event_id=v_event_id and t.run_nonce=v_state.run_nonce and t.status='accepted';

  if v_final.id is not null then
    select count(*)::integer into v_wrong
    from public.bunker_mission_decisions d
    where d.instance_id=v_final.id
      and d.decision_key like 'final_access_%'
      and coalesce((d.outcome->>'success')::boolean,false)=false;
  end if;

  select count(*)::integer into v_skills
  from public.bunker_ability_uses u
  where u.event_id=v_event_id and u.run_nonce=v_state.run_nonce and u.status='committed';

  select
    count(*) filter(where i.status='completed')::integer,
    count(*)::integer
  into v_missions_completed,v_missions_total
  from public.bunker_mission_instances i
  where i.event_id=v_event_id
    and i.run_nonce=v_state.run_nonce
    and i.mission_code in ('MISSION_01','MISSION_02','MISSION_03','MISSION_04','MISSION_05','MISSION_06');

  select exists(
    select 1 from public.bunker_mission_instances i
    where i.event_id=v_event_id
      and i.run_nonce=v_state.run_nonce
      and i.mission_code='MISSION_06'
      and i.outcome->>'status'='success'
  ) into v_m06_success;

  v_coordination := greatest(0,least(100,
    case when v_missions_total>0 then round(40.0*v_missions_completed/v_missions_total)::integer else 0 end
    + case when v_m06_success then 20 else 0 end
    + least(10,v_trades*2)
    + case when v_final_success then 20 else 5 end
    + least(10,v_skills*2)
    - v_wrong*3
    - v_hints*2
  ));

  return jsonb_build_object(
    'contractVersion',2,
    'status','completed',
    'serverNow',v_now,
    'finishTimeSeconds',v_finish,
    'emergencyOpen',v_emergency,
    'characters',jsonb_build_object('active',coalesce(v_active,0),'saved',coalesce(v_saved,0),'excluded',coalesce(v_excluded,0)),
    'archiveFound',coalesce(v_archive,0),
    'resourcesRemaining',coalesce(v_remaining,0),
    'resourcesUsed',coalesce(v_used,0),
    'tradesCompleted',coalesce(v_trades,0),
    'wrongAttempts',coalesce(v_wrong,0),
    'hintsUsed',coalesce(v_hints,0),
    'skillsUsed',coalesce(v_skills,0),
    'missionsCompleted',coalesce(v_missions_completed,0),
    'missionsTotal',coalesce(v_missions_total,0),
    'coordinationScore',v_coordination
  );
end;
$$;

revoke all on function public.get_bunker_v2_results(text) from public,anon,authenticated;
grant execute on function public.get_bunker_v2_results(text) to anon,authenticated;
