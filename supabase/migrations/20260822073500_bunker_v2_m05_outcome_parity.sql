-- Forward-only M05 correction to the approved V2 design.
-- route_bonus is canonical M05 bonus MINUTES from this migration onward.

create or replace function public._bunker_v2_m05_ability_allowed(p_ability text)
returns boolean
language sql
immutable
security definer
set search_path=''
as $$
  select p_ability in (
    'route_analysis','terrain_analysis','route_feel','map_reconstruction',
    'dangerous_route','physical_task',
    'mechanical_fix','power_restore','power_bypass','structure_analysis'
  );
$$;
revoke all on function public._bunker_v2_m05_ability_allowed(text) from public,anon,authenticated;

create or replace function public._bunker_v2_calculate_m05_outcome(
  p_choice text,
  p_scenario_key text,
  p_inventory jsonb,
  p_saved_profiles text[],
  p_committed_abilities text[],
  p_fallback boolean
)
returns jsonb
language plpgsql
immutable
security definer
set search_path=''
as $$
declare
  v_choice text:=upper(btrim(coalesce(p_choice,'')));
  v_last integer;
  v_band integer;
  v_navigation boolean:=false;
  v_technical boolean:=false;
  v_protection boolean:=false;
  v_support integer:=0;
  v_best_required integer;
  v_medium_required integer;
begin
  if v_choice not in ('A','B') then raise exception 'invalid M05 route' using errcode='22023'; end if;
  if coalesce(p_scenario_key,'') !~* '^route_[0-9a-f]{12}$' then raise exception 'invalid M05 scenario key' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_inventory,'[]'::jsonb))<>'array' then raise exception 'invalid M05 inventory snapshot' using errcode='22023'; end if;

  if v_choice='B' then
    return jsonb_build_object(
      'routeChoice','B','routeBonusMinutes',-5,'trackDamage',0,
      'powerInstability',0,'sector04Found',false,'fallback',coalesce(p_fallback,false),'tier','safe'
    );
  end if;

  v_last:=get_byte(decode('0'||right(lower(p_scenario_key),1),'hex'),0);
  v_band:=mod(v_last,3);

  v_navigation:=coalesce(p_saved_profiles,array[]::text[]) && array['train_driver','geologist','cartographer','driver']::text[]
    or coalesce(p_committed_abilities,array[]::text[]) && array['route_analysis','terrain_analysis','route_feel','map_reconstruction']::text[];
  v_technical:=exists(select 1 from jsonb_array_elements_text(coalesce(p_inventory,'[]'::jsonb)) item(value) where item.value in ('tools','generator'))
    or coalesce(p_saved_profiles,array[]::text[]) && array['power_engineer','electrician','mechanic','military_engineer','builder']::text[]
    or coalesce(p_committed_abilities,array[]::text[]) && array['mechanical_fix','power_restore','power_bypass','structure_analysis']::text[];
  v_protection:=exists(select 1 from jsonb_array_elements_text(coalesce(p_inventory,'[]'::jsonb)) item(value) where item.value='gas_mask')
    or coalesce(p_saved_profiles,array[]::text[]) && array['rescuer','firefighter','climber','athlete']::text[]
    or coalesce(p_committed_abilities,array[]::text[]) && array['dangerous_route','physical_task']::text[];

  v_support:=v_navigation::integer+v_technical::integer+v_protection::integer;
  v_best_required:=case when v_band=0 then 2 else 3 end;
  v_medium_required:=case when v_band=2 then 2 else 1 end;

  if v_support>=v_best_required then
    return jsonb_build_object(
      'routeChoice','A','routeBonusMinutes',7,'trackDamage',0,
      'powerInstability',0,'sector04Found',true,'fallback',coalesce(p_fallback,false),'tier','best'
    );
  elsif v_support>=v_medium_required then
    return jsonb_build_object(
      'routeChoice','A','routeBonusMinutes',4,'trackDamage',0,
      'powerInstability',1,'sector04Found',false,'fallback',coalesce(p_fallback,false),'tier','medium'
    );
  end if;
  return jsonb_build_object(
    'routeChoice','A','routeBonusMinutes',0,'trackDamage',20,
    'powerInstability',0,'sector04Found',false,'fallback',coalesce(p_fallback,false),'tier','poor'
  );
end;
$$;
revoke all on function public._bunker_v2_calculate_m05_outcome(text,text,jsonb,text[],text[],boolean) from public,anon,authenticated;

create or replace function public._bunker_v2_apply_m05_outcome(
  p_event_id uuid,p_run_nonce uuid,p_carriage_id uuid,p_choice text,p_fallback boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_state public.bunker_wagon_state%rowtype;
  v_instance public.bunker_mission_instances%rowtype;
  v_inventory jsonb:='[]'::jsonb;
  v_saved text[]:=array[]::text[];
  v_abilities text[]:=array[]::text[];
  v_scenario text;
  v_outcome jsonb;
  v_technical_role boolean:=false;
  v_protection_role boolean:=false;
  v_technical_ability boolean:=false;
  v_protection_ability boolean:=false;
  v_item text;
begin
  select i.* into v_instance
  from public.bunker_mission_instances i
  where i.event_id=p_event_id and i.run_nonce=p_run_nonce
    and i.mission_code='MISSION_05' and i.scope_key=p_carriage_id::text
  limit 1 for update;
  if v_instance.id is null then raise exception 'M05 instance missing' using errcode='55000'; end if;
  if coalesce(v_instance.outcome->>'routeChoice','') in ('A','B') then return v_instance.outcome; end if;

  select w.* into v_state
  from public.bunker_wagon_state w
  where w.event_id=p_event_id and w.run_nonce=p_run_nonce and w.carriage_id=p_carriage_id
  for update;
  if v_state.carriage_id is null then raise exception 'M05 wagon state missing' using errcode='55000'; end if;

  v_scenario:=v_instance.definition#>>'{scenario,scenarioKey}';
  select coalesce(jsonb_agg(item_key order by item_key),'[]'::jsonb) into v_inventory
  from (select distinct l.item_key from public.bunker_inventory_lots l
        where l.event_id=p_event_id and l.run_nonce=p_run_nonce and l.carriage_id=p_carriage_id and l.status='available') available;
  select coalesce(array_agg(distinct p.character_profile_key) filter(where p.character_profile_key is not null),array[]::text[])
  into v_saved
  from public.bunker_guest_profiles p
  join public.guests g on g.id=p.guest_id and g.event_id=p_event_id
  where p.event_id=p_event_id and p.run_nonce=p_run_nonce and g.carriage_id=p_carriage_id and p.character_status='saved';
  select coalesce(array_agg(distinct u.ability_key),array[]::text[]) into v_abilities
  from public.bunker_ability_uses u
  where u.event_id=p_event_id and u.run_nonce=p_run_nonce and u.instance_id=v_instance.id and u.status='committed';

  v_outcome:=public._bunker_v2_calculate_m05_outcome(p_choice,v_scenario,v_inventory,v_saved,v_abilities,p_fallback);

  if upper(btrim(p_choice))='A' then
    v_technical_role:=v_saved && array['power_engineer','electrician','mechanic','military_engineer','builder']::text[];
    v_protection_role:=v_saved && array['rescuer','firefighter','climber','athlete']::text[];
    v_technical_ability:=v_abilities && array['mechanical_fix','power_restore','power_bypass','structure_analysis']::text[];
    v_protection_ability:=v_abilities && array['dangerous_route','physical_task']::text[];
    if not v_technical_role and not v_technical_ability then
      select l.item_key into v_item from public.bunker_inventory_lots l
      where l.event_id=p_event_id and l.run_nonce=p_run_nonce and l.carriage_id=p_carriage_id
        and l.status='available' and l.item_key in ('tools','generator')
      order by case l.item_key when 'tools' then 0 else 1 end,l.acquired_at,l.id limit 1;
      if v_item is not null then perform public._bunker_v2_consume_inventory(p_event_id,p_run_nonce,p_carriage_id,v_item,1,v_instance.id); end if;
    end if;
    if not v_protection_role and not v_protection_ability
      and exists(select 1 from public.bunker_inventory_lots l where l.event_id=p_event_id and l.run_nonce=p_run_nonce and l.carriage_id=p_carriage_id and l.status='available' and l.item_key='gas_mask') then
      perform public._bunker_v2_consume_inventory(p_event_id,p_run_nonce,p_carriage_id,'gas_mask',1,v_instance.id);
    end if;
  end if;

  update public.bunker_wagon_state
  set route_choice=upper(btrim(p_choice)),
      route_bonus=route_bonus+(v_outcome->>'routeBonusMinutes')::integer,
      track_damage=least(100,track_damage+(v_outcome->>'trackDamage')::integer),
      power_instability=power_instability+(v_outcome->>'powerInstability')::integer,
      sector04_found=sector04_found or coalesce((v_outcome->>'sector04Found')::boolean,false),
      updated_at=now()
  where event_id=p_event_id and run_nonce=p_run_nonce and carriage_id=p_carriage_id;
  return v_outcome;
end;
$$;
revoke all on function public._bunker_v2_apply_m05_outcome(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;

create or replace function public._submit_bunker_command_m05(
  p_event_slug text,p_device_key text,p_command_id uuid,p_command_type text,p_payload jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_event_id uuid;v_guest public.guests%rowtype;v_state public.bunker_state%rowtype;v_run public.bunker_game_runs%rowtype;
 v_instance public.bunker_mission_instances%rowtype;v_member public.bunker_mission_members%rowtype;v_profile public.bunker_guest_profiles%rowtype;
 v_existing public.bunker_command_receipts%rowtype;v_hash text;v_vote text;v_a integer;v_b integer;v_total integer;v_members integer;v_required integer;
 v_choice text;v_outcome jsonb;v_hint text;v_result jsonb;v_now timestamptz:=clock_timestamp();
begin
 if p_command_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid M05 command' using errcode='22023';end if;
 select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);if v_event_id is null then raise exception 'Bunker event not found' using errcode='P0002';end if;
 select g.* into v_guest from public.guests g where g.event_id=v_event_id and g.id=public._bunker_guest_id(p_event_slug,p_device_key);if v_guest.id is null then raise exception 'registered Bunker guest required' using errcode='42501';end if;
 select s.* into v_state from public.bunker_state s where s.event_id=v_event_id for update;if v_state.run_nonce is null then raise exception 'active Bunker V2 run required' using errcode='55000';end if;
 select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;if v_run.contract_version<>2 then raise exception 'active Bunker V2 run required' using errcode='55000';end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('commandType',p_command_type,'payload',p_payload)::text,'UTF8'),'sha256'),'hex');
 select r.* into v_existing from public.bunker_command_receipts r where r.run_nonce=v_state.run_nonce and r.actor_kind='guest' and r.actor_id=v_guest.id and r.command_id=p_command_id;
 if v_existing.id is not null then if v_existing.request_hash<>v_hash then raise exception 'idempotency_conflict' using errcode='55000';end if;return v_existing.result;end if;
 if v_state.global_game_state<>'MISSION_05' then raise exception 'M05 is not the current Bunker V2 stage' using errcode='55000';end if;
 begin select i.* into v_instance from public.bunker_mission_instances i where i.event_id=v_event_id and i.run_nonce=v_state.run_nonce and i.id=(p_payload->>'instanceId')::uuid for update;exception when invalid_text_representation then raise exception 'invalid M05 instance id' using errcode='22023';end;
 if v_instance.id is null or v_instance.mission_code<>'MISSION_05' or v_instance.scope_key<>v_guest.carriage_id::text then raise exception 'M05 instance does not belong to guest wagon' using errcode='42501';end if;
 if v_instance.status<>'active' then raise exception 'M05 instance is not active' using errcode='55000';end if;
 select m.* into v_member from public.bunker_mission_members m where m.instance_id=v_instance.id and m.guest_id=v_guest.id for update;if v_member.id is null then raise exception 'M05 frozen member required' using errcode='42501';end if;
 select p.* into v_profile from public.bunker_guest_profiles p where p.run_nonce=v_state.run_nonce and p.guest_id=v_guest.id for update;
 if p_command_type='use_ability' then
  if p_payload->>'problemKey'<>'route_choice' or not public._bunker_v2_m05_ability_allowed(v_profile.special_ability) or v_profile.ability_uses_remaining<1 then raise exception 'M05 route ability unavailable' using errcode='42501';end if;
  if exists(select 1 from public.bunker_ability_uses u where u.instance_id=v_instance.id and u.guest_id=v_guest.id and u.ability_key=v_profile.special_ability and u.status='committed') then raise exception 'M05 route ability already used' using errcode='55000';end if;
  v_hint:=case
    when v_profile.special_ability in ('route_analysis','terrain_analysis','route_feel','map_reconstruction') then 'Навигационный анализ снижает неопределённость технического тоннеля.'
    when v_profile.special_ability in ('mechanical_fix','power_restore','power_bypass','structure_analysis') then 'Техническая подготовка повышает шанс пройти маршрут A без повреждений.'
    else 'Физическая подготовка снижает риск опасного участка маршрута A.' end;
  insert into public.bunker_ability_uses(event_id,run_nonce,instance_id,guest_id,ability_key,problem_key,status,command_id,effect,committed_at)
  values(v_event_id,v_state.run_nonce,v_instance.id,v_guest.id,v_profile.special_ability,'route_choice','committed',p_command_id,jsonb_build_object('hint',v_hint),v_now);
  update public.bunker_guest_profiles set ability_uses_remaining=ability_uses_remaining-1,ability_used_at=v_now where run_nonce=v_state.run_nonce and guest_id=v_guest.id and ability_uses_remaining>0;
  if not found then raise exception 'M05 ability changed concurrently' using errcode='40001';end if;
 elsif p_command_type='cast_vote' then
  v_vote:=upper(btrim(p_payload->>'vote'));if v_vote not in ('A','B') then raise exception 'M05 vote must be A or B' using errcode='22023';end if;
  insert into public.bunker_mission_decisions(event_id,run_nonce,instance_id,decision_key,actor_kind,actor_id,actor_scope_key,status,instance_version,command_id,payload,outcome,confirmed_at)
  values(v_event_id,v_state.run_nonce,v_instance.id,'m05_vote','guest',v_guest.id,v_guest.id::text,'confirmed',v_instance.instance_version,p_command_id,jsonb_build_object('vote',v_vote),jsonb_build_object('vote',v_vote),v_now)
  on conflict(instance_id,decision_key,actor_kind,actor_scope_key) do update set actor_id=excluded.actor_id,command_id=excluded.command_id,payload=excluded.payload,outcome=excluded.outcome,confirmed_at=excluded.confirmed_at;
  select count(*) filter(where d.payload->>'vote'='A')::integer,count(*) filter(where d.payload->>'vote'='B')::integer,count(*)::integer into v_a,v_b,v_total from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key='m05_vote' and d.status='confirmed';
  select count(*)::integer into v_members from public.bunker_mission_members m where m.instance_id=v_instance.id;v_required:=floor(v_members/2.0)::integer+1;
  if v_a>=v_required or v_b>=v_required or v_total>=v_members then
   v_choice:=case when v_a>v_b then 'A' else 'B' end;
   v_outcome:=public._bunker_v2_apply_m05_outcome(v_event_id,v_state.run_nonce,v_guest.carriage_id,v_choice,false);
   update public.bunker_mission_instances set status='completed',completed_at=v_now,outcome=v_outcome where id=v_instance.id;
   update public.bunker_mission_members set member_status='completed',updated_at=v_now where instance_id=v_instance.id;
  end if;
 else raise exception 'unsupported M05 command type' using errcode='22023';end if;
 v_result:=jsonb_build_object('contractVersion',2,'status','accepted','commandId',p_command_id,'commandType',p_command_type);
 insert into public.bunker_command_receipts(event_id,run_nonce,actor_kind,actor_id,command_id,command_type,request_hash,result) values(v_event_id,v_state.run_nonce,'guest',v_guest.id,p_command_id,p_command_type,v_hash,v_result);
 insert into public.bunker_game_events(event_id,run_nonce,carriage_id,guest_id,event_type,actor_type,actor_id,command_id,correlation_id,instance_id,schema_version,payload) values(v_event_id,v_state.run_nonce,v_guest.carriage_id,v_guest.id,'m05_'||p_command_type,'guest',v_guest.id,p_command_id,p_command_id,v_instance.id,2,jsonb_build_object('missionCode','MISSION_05','commandType',p_command_type));
 return v_result;
end;$$;
revoke all on function public._submit_bunker_command_m05(text,text,uuid,text,jsonb) from public,anon,authenticated;

create or replace function public.get_guest_bunker_v2_m05(p_event_slug text,p_device_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_event_id uuid;v_guest public.guests%rowtype;v_state public.bunker_state%rowtype;v_run public.bunker_game_runs%rowtype;v_instance public.bunker_mission_instances%rowtype;
 v_profile public.bunker_guest_profiles%rowtype;v_wagon public.carriages%rowtype;v_selected text;v_a integer;v_b integer;v_total integer;v_members integer;v_required integer;
 v_ability jsonb:=null;v_hint text;v_now timestamptz:=clock_timestamp();
begin
 select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);if v_event_id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now);end if;
 select g.* into v_guest from public.guests g where g.event_id=v_event_id and g.id=public._bunker_guest_id(p_event_slug,p_device_key);if v_guest.id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now);end if;
 select s.* into v_state from public.bunker_state s where s.event_id=v_event_id;if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);end if;
 select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;if v_run.contract_version<>2 then return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now);end if;
 select i.* into v_instance from public.bunker_mission_instances i where i.run_nonce=v_state.run_nonce and i.mission_code='MISSION_05' and i.scope_key=v_guest.carriage_id::text limit 1;
 if v_instance.id is null or v_state.global_game_state not in ('MISSION_05','MISSION_06','UNKNOWN_PASSENGER','BREAK_BEFORE_FINAL','FINAL_30','BUNKER_OPEN','FINISHED') then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);end if;
 select p.* into v_profile from public.bunker_guest_profiles p where p.run_nonce=v_state.run_nonce and p.guest_id=v_guest.id;
 select c.* into v_wagon from public.carriages c where c.id=v_guest.carriage_id;
 select d.payload->>'vote' into v_selected from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key='m05_vote' and d.actor_kind='guest' and d.actor_scope_key=v_guest.id::text limit 1;
 select count(*) filter(where d.payload->>'vote'='A')::integer,count(*) filter(where d.payload->>'vote'='B')::integer,count(*)::integer into v_a,v_b,v_total from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key='m05_vote' and d.status='confirmed';
 select count(*)::integer into v_members from public.bunker_mission_members m where m.instance_id=v_instance.id;v_required:=floor(v_members/2.0)::integer+1;
 if public._bunker_v2_m05_ability_allowed(v_profile.special_ability) then
  select u.effect->>'hint' into v_hint from public.bunker_ability_uses u where u.instance_id=v_instance.id and u.guest_id=v_guest.id and u.problem_key='route_choice' limit 1;
  v_ability:=jsonb_build_object('available',v_profile.ability_uses_remaining>0 and v_hint is null,'key',v_profile.special_ability,'label',v_profile.ability_description,'hint',coalesce(v_hint,'Можно один раз применить способность к оценке опасного маршрута.'));
 end if;
 return jsonb_strip_nulls(jsonb_build_object(
  'contractVersion',2,'status',case when v_instance.status='completed' then 'completed' else 'active' end,'serverNow',v_now,
  'deadlineAt',coalesce(v_instance.deadline_at,v_now),'instanceId',v_instance.id,'instanceVersion',v_instance.instance_version,
  'title',v_instance.definition->>'title','intro',v_instance.definition->>'intro','wagon',jsonb_build_object('number',v_wagon.number,'label',v_wagon.label),
  'routes',v_instance.definition->'routes','selectedVote',v_selected,'voteCounts',jsonb_build_object('A',coalesce(v_a,0),'B',coalesce(v_b,0),'total',coalesce(v_total,0),'required',v_required),
  'ability',v_ability,'outcome',case when v_instance.status='completed' then v_instance.outcome else null end));
end;$$;
revoke all on function public.get_guest_bunker_v2_m05(text,text) from public,anon,authenticated;
grant execute on function public.get_guest_bunker_v2_m05(text,text) to anon,authenticated;

-- Only approved M05 route bonus minutes change the final duration.
create or replace function public._bunker_v2_final_transition()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_contract integer;v_instance public.bunker_mission_instances%rowtype;v_bonus integer:=0;v_now timestamptz:=clock_timestamp();
begin
 if new.run_nonce is null or old.global_game_state is not distinct from new.global_game_state then return new;end if;
 select r.contract_version into v_contract from public.bunker_game_runs r where r.event_id=new.event_id and r.run_nonce=new.run_nonce;
 if v_contract is distinct from 2 then return new;end if;
 if new.global_game_state='FINAL_30' then
  select i.* into v_instance from public.bunker_mission_instances i where i.event_id=new.event_id and i.run_nonce=new.run_nonce and i.mission_code='FINAL_30' limit 1 for update;
  select greatest(-300,least(600,coalesce(sum(w.route_bonus),0)::integer*60)) into v_bonus
  from public.bunker_wagon_state w where w.event_id=new.event_id and w.run_nonce=new.run_nonce;
  update public.bunker_state set final_duration=1800+v_bonus,final_started_at=coalesce(final_started_at,v_now),updated_at=now() where event_id=new.event_id;
  update public.bunker_mission_instances set status='active',started_at=coalesce(started_at,v_now),deadline_at=v_now+make_interval(secs=>1800+v_bonus),definition=definition||jsonb_build_object('title','30 минут до Бункера','timeAdjustmentSeconds',v_bonus,'ownerHintLevel',0) where id=v_instance.id;
 end if;
 return new;
end;$$;
revoke all on function public._bunker_v2_final_transition() from public,anon,authenticated;
