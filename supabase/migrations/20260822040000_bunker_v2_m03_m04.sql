-- Bunker V2 M03 «Аварийный запас» + M04 «Межвагонная связь».
-- Forward-only. Published M01/M02 migrations are not edited.

create or replace function public._bunker_v2_m03_definition()
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', 'Аварийный запас',
    'intro', 'У вагона пять проблем. Закрыть можно не больше трёх. Неиспользованный запас останется для следующих заданий.',
    'problems', jsonb_build_array(
      jsonb_build_object('key','injury','title','Ранен пассажир','risk','Без помощи состояние пострадавшего ухудшится.','itemKey','medkit'),
      jsonb_build_object('key','communication','title','Пропадает связь','risk','Вагон потеряет связь с соседними вагонами.','itemKey','radio'),
      jsonb_build_object('key','power','title','Падает питание','risk','Часть систем вагона начнёт отключаться.','itemKey','generator'),
      jsonb_build_object('key','mechanism','title','Заклинило механизм','risk','Техническая дверь может быть повреждена.','itemKey','tools'),
      jsonb_build_object('key','water','title','Запас воды под угрозой','risk','Питьевая вода станет ограниченной.','itemKey','water')
    )
  );
$$;
revoke all on function public._bunker_v2_m03_definition() from public, anon, authenticated;

create or replace function public._bunker_v2_m04_definition()
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', 'Межвагонная связь',
    'answerOptions', jsonb_build_array('СВЯЗЬ','ПИТАНИЕ','МАРШРУТ')
  );
$$;
revoke all on function public._bunker_v2_m04_definition() from public, anon, authenticated;

update public.bunker_mission_instances
set definition = definition || public._bunker_v2_m03_definition()
where mission_code = 'MISSION_03' and definition->>'contractVersion' = '2';

update public.bunker_mission_instances
set definition = definition || public._bunker_v2_m04_definition()
where mission_code = 'MISSION_04' and definition->>'contractVersion' = '2';

create or replace function public._bunker_v2_enrich_m03_m04_instance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.definition->>'contractVersion' = '2' then
    if new.mission_code = 'MISSION_03' then
      new.definition := new.definition || public._bunker_v2_m03_definition();
    elsif new.mission_code = 'MISSION_04' then
      new.definition := new.definition || public._bunker_v2_m04_definition();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public._bunker_v2_enrich_m03_m04_instance() from public, anon, authenticated;

drop trigger if exists bunker_v2_enrich_m03_m04_before_insert on public.bunker_mission_instances;
create trigger bunker_v2_enrich_m03_m04_before_insert
before insert on public.bunker_mission_instances
for each row execute function public._bunker_v2_enrich_m03_m04_instance();

create table public.bunker_intercarriage_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  run_nonce uuid not null,
  instance_id uuid not null,
  group_key text not null check (length(btrim(group_key)) > 0),
  from_carriage_id uuid not null,
  from_guest_id uuid not null,
  message text not null check (char_length(btrim(message)) between 1 and 120),
  message_index integer not null check (message_index between 1 and 4),
  created_at timestamptz not null default clock_timestamp(),
  unique (instance_id, from_carriage_id, message_index),
  foreign key (event_id, run_nonce)
    references public.bunker_game_runs(event_id, run_nonce) on delete cascade,
  foreign key (instance_id, event_id, run_nonce)
    references public.bunker_mission_instances(id, event_id, run_nonce) on delete cascade,
  constraint bunker_intercarriage_messages_carriage_event_fkey
    foreign key (from_carriage_id, event_id)
    references public.carriages(id, event_id) on delete cascade,
  constraint bunker_intercarriage_messages_guest_event_fkey
    foreign key (from_guest_id, event_id)
    references public.guests(id, event_id) on delete cascade
);

create index bunker_intercarriage_messages_run_instance_idx
  on public.bunker_intercarriage_messages(run_nonce, instance_id, created_at);
create index bunker_intercarriage_messages_sender_idx
  on public.bunker_intercarriage_messages(instance_id, from_carriage_id, created_at);
alter table public.bunker_intercarriage_messages enable row level security;
revoke all on table public.bunker_intercarriage_messages from public, anon, authenticated;

create or replace function public._bunker_v2_consume_inventory(
  p_event_id uuid,
  p_run_nonce uuid,
  p_carriage_id uuid,
  p_item_key text,
  p_quantity integer,
  p_command_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.bunker_inventory_lots%rowtype;
  v_used_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  if p_quantity is null or p_quantity < 1 or coalesce(btrim(p_item_key), '') = '' then
    raise exception 'invalid inventory consumption' using errcode = '22023';
  end if;

  select lot.*
  into v_source
  from public.bunker_inventory_lots lot
  where lot.event_id = p_event_id
    and lot.run_nonce = p_run_nonce
    and lot.carriage_id = p_carriage_id
    and lot.item_key = p_item_key
    and lot.status = 'available'
    and lot.quantity >= p_quantity
  order by lot.acquired_at, lot.id
  limit 1
  for update;

  if v_source.id is null then
    raise exception 'Bunker inventory item is unavailable' using errcode = '55000';
  end if;

  if v_source.quantity = p_quantity then
    update public.bunker_inventory_lots
    set status = 'used',
        used_at = v_now,
        metadata = metadata || jsonb_build_object('consumedByCommandId', p_command_id)
    where id = v_source.id;
    return v_source.id;
  end if;

  update public.bunker_inventory_lots
  set quantity = quantity - p_quantity,
      metadata = metadata || jsonb_build_object('lastSplitByCommandId', p_command_id)
  where id = v_source.id
    and quantity - p_quantity > 0;
  if not found then
    raise exception 'Bunker inventory changed concurrently' using errcode = '40001';
  end if;

  insert into public.bunker_inventory_lots(
    event_id, run_nonce, carriage_id, item_key, quantity,
    status, acquired_at, used_at, source_lot_id, metadata
  )
  values (
    p_event_id, p_run_nonce, p_carriage_id, p_item_key, p_quantity,
    'used', v_now, v_now, v_source.id,
    jsonb_build_object('consumedByCommandId', p_command_id)
  )
  returning id into v_used_id;

  return v_used_id;
end;
$$;
revoke all on function public._bunker_v2_consume_inventory(uuid,uuid,uuid,text,integer,uuid)
  from public, anon, authenticated;

create or replace function public._bunker_v2_m03_problem_for_ability(p_ability text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case p_ability
    when 'medical_help' then 'injury'
    when 'stabilize_person' then 'injury'
    when 'emergency_action' then 'injury'
    when 'hazard_entry' then 'injury'
    when 'weak_signal' then 'communication'
    when 'power_restore' then 'power'
    when 'power_bypass' then 'power'
    when 'mechanical_fix' then 'mechanism'
    when 'structure_analysis' then 'mechanism'
    when 'water_treatment' then 'water'
    when 'chemical_analysis' then 'water'
    when 'bio_scan' then 'water'
    else null
  end;
$$;
revoke all on function public._bunker_v2_m03_problem_for_ability(text) from public, anon, authenticated;

create or replace function public._submit_bunker_command_m03(
  p_event_slug text,
  p_device_key text,
  p_command_id uuid,
  p_command_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_guest public.guests%rowtype;
  v_state public.bunker_state%rowtype;
  v_run public.bunker_game_runs%rowtype;
  v_instance public.bunker_mission_instances%rowtype;
  v_member public.bunker_mission_members%rowtype;
  v_profile public.bunker_guest_profiles%rowtype;
  v_existing public.bunker_command_receipts%rowtype;
  v_request_hash text;
  v_problem_key text;
  v_expected_problem text;
  v_selection jsonb;
  v_selected_count integer;
  v_distinct_count integer;
  v_problem record;
  v_ability public.bunker_ability_uses%rowtype;
  v_item_key text;
  v_outcome jsonb;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if p_command_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid M03 command' using errcode = '22023';
  end if;

  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then raise exception 'Bunker event not found' using errcode = 'P0002'; end if;

  select guest.* into v_guest
  from public.guests guest
  where guest.event_id = v_event_id
    and guest.id = public._bunker_guest_id(p_event_slug, p_device_key);
  if v_guest.id is null then raise exception 'registered Bunker guest required' using errcode = '42501'; end if;

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = v_event_id
  for update;
  if v_state.run_nonce is null then raise exception 'active Bunker V2 run required' using errcode = '55000'; end if;

  select run.* into v_run
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_state.run_nonce;
  if v_run.contract_version is distinct from 2 then raise exception 'active Bunker V2 run required' using errcode = '55000'; end if;

  v_request_hash := encode(extensions.digest(convert_to(
    jsonb_build_object('commandType',p_command_type,'payload',p_payload)::text,
    'UTF8'), 'sha256'), 'hex');

  select receipt.* into v_existing
  from public.bunker_command_receipts receipt
  where receipt.event_id = v_event_id
    and receipt.run_nonce = v_state.run_nonce
    and receipt.actor_kind = 'guest'
    and receipt.actor_id = v_guest.id
    and receipt.command_id = p_command_id;
  if v_existing.id is not null then
    if v_existing.request_hash <> v_request_hash then raise exception 'idempotency_conflict' using errcode = '55000'; end if;
    return v_existing.result;
  end if;

  if v_state.global_game_state <> 'MISSION_03' then raise exception 'M03 is not the current Bunker V2 stage' using errcode = '55000'; end if;

  begin
    select instance.* into v_instance
    from public.bunker_mission_instances instance
    where instance.event_id = v_event_id
      and instance.run_nonce = v_state.run_nonce
      and instance.id = (p_payload->>'instanceId')::uuid
    for update;
  exception when invalid_text_representation then
    raise exception 'invalid M03 instance id' using errcode = '22023';
  end;

  if v_instance.id is null or v_instance.mission_code <> 'MISSION_03' then raise exception 'M03 instance not found' using errcode = 'P0002'; end if;
  if v_instance.scope_kind <> 'wagon' or v_instance.scope_key <> v_guest.carriage_id::text then raise exception 'M03 instance does not belong to the guest wagon' using errcode = '42501'; end if;
  if v_instance.status <> 'active' then raise exception 'M03 instance is not active' using errcode = '55000'; end if;

  select member.* into v_member
  from public.bunker_mission_members member
  where member.instance_id = v_instance.id and member.guest_id = v_guest.id
  for update;
  if v_member.id is null then raise exception 'M03 frozen member required' using errcode = '42501'; end if;

  select profile.* into v_profile
  from public.bunker_guest_profiles profile
  where profile.run_nonce = v_state.run_nonce and profile.guest_id = v_guest.id
  for update;

  if p_command_type = 'use_ability' then
    if (select count(*) from jsonb_object_keys(p_payload)) <> 2
      or not (p_payload ?& array['instanceId','problemKey']) then
      raise exception 'invalid M03 ability payload' using errcode = '22023';
    end if;
    v_problem_key := p_payload->>'problemKey';
    v_expected_problem := public._bunker_v2_m03_problem_for_ability(v_profile.special_ability);
    if v_expected_problem is null or v_expected_problem <> v_problem_key or v_profile.ability_uses_remaining < 1 then
      raise exception 'M03 ability is unavailable for this problem' using errcode = '42501';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(v_instance.definition->'problems') problem(value)
      where problem.value->>'key' = v_problem_key
    ) then raise exception 'M03 problem not found' using errcode = '22023'; end if;

    insert into public.bunker_ability_uses(
      event_id, run_nonce, instance_id, guest_id, ability_key,
      problem_key, status, command_id, effect
    )
    values (
      v_event_id, v_state.run_nonce, v_instance.id, v_guest.id,
      v_profile.special_ability, v_problem_key, 'pending', p_command_id,
      jsonb_build_object('label', v_profile.ability_description)
    );

  elsif p_command_type = 'mission_confirm' then
    if v_member.member_role <> 'captain' then raise exception 'M03 confirmation requires wagon captain' using errcode = '42501'; end if;
    if (select count(*) from jsonb_object_keys(p_payload)) <> 3
      or not (p_payload ?& array['instanceId','instanceVersion','selection'])
      or jsonb_typeof(p_payload->'selection') <> 'array' then
      raise exception 'invalid M03 confirmation payload' using errcode = '22023';
    end if;
    if (p_payload->>'instanceVersion')::integer <> v_instance.instance_version then raise exception 'M03 instance version changed' using errcode = '55000'; end if;

    v_selection := p_payload->'selection';
    v_selected_count := jsonb_array_length(v_selection);
    select count(distinct value)::integer into v_distinct_count
    from jsonb_array_elements_text(v_selection) selected(value);
    if v_selected_count not between 1 and 3 or v_distinct_count <> v_selected_count then
      raise exception 'M03 allows one to three unique problems' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(v_selection) selected(value)
      where not exists (
        select 1 from jsonb_array_elements(v_instance.definition->'problems') problem(value)
        where problem.value->>'key' = selected.value
      )
    ) then raise exception 'M03 selection contains an unknown problem' using errcode = '22023'; end if;

    perform 1 from public.bunker_inventory_lots lot
    where lot.run_nonce = v_state.run_nonce and lot.carriage_id = v_guest.carriage_id and lot.status = 'available'
    order by lot.id for update;
    perform 1 from public.bunker_ability_uses use
    where use.run_nonce = v_state.run_nonce and use.instance_id = v_instance.id and use.status = 'pending'
    order by use.id for update;

    for v_problem in
      select problem.value->>'key' as key, problem.value->>'itemKey' as item_key
      from jsonb_array_elements(v_instance.definition->'problems') problem(value)
      where (problem.value->>'key') in (select value from jsonb_array_elements_text(v_selection))
    loop
      select use.* into v_ability
      from public.bunker_ability_uses use
      where use.instance_id = v_instance.id
        and use.problem_key = v_problem.key
        and use.status = 'pending'
      order by use.created_at, use.id
      limit 1
      for update;

      if v_ability.id is not null then
        update public.bunker_ability_uses
        set status = 'committed', committed_at = v_now,
            effect = coalesce(effect,'{}'::jsonb) || jsonb_build_object('acceptedByCaptain', true)
        where id = v_ability.id;
        update public.bunker_guest_profiles
        set ability_uses_remaining = ability_uses_remaining - 1,
            ability_used_at = v_now
        where run_nonce = v_state.run_nonce
          and guest_id = v_ability.guest_id
          and ability_uses_remaining > 0;
        if not found then raise exception 'M03 ability changed concurrently' using errcode = '40001'; end if;
      else
        perform public._bunker_v2_consume_inventory(
          v_event_id, v_state.run_nonce, v_guest.carriage_id,
          v_problem.item_key, 1, p_command_id
        );
      end if;
      v_ability := null;
    end loop;

    update public.bunker_ability_uses
    set status = 'rejected',
        effect = coalesce(effect,'{}'::jsonb) || jsonb_build_object('acceptedByCaptain', false)
    where instance_id = v_instance.id and status = 'pending';

    update public.bunker_wagon_state
    set communication_status = case when v_selection ? 'communication' then 'working' else 'degraded' end,
        power_status = case when v_selection ? 'power' then 'stable' else 'unstable' end,
        power_instability = power_instability + case when v_selection ? 'power' then 0 else 1 end,
        technical_door_status = case when v_selection ? 'mechanism' then 'unlocked' else 'damaged' end,
        water_status = case when v_selection ? 'water' then 'stable' else 'limited' end,
        updated_at = now()
    where event_id = v_event_id and run_nonce = v_state.run_nonce and carriage_id = v_guest.carriage_id;

    v_outcome := jsonb_build_object(
      'selectedProblems', v_selection,
      'solvedCount', v_selected_count,
      'injuryUnresolved', not (v_selection ? 'injury'),
      'communicationDegraded', not (v_selection ? 'communication'),
      'powerUnstable', not (v_selection ? 'power'),
      'mechanismDamaged', not (v_selection ? 'mechanism'),
      'waterLimited', not (v_selection ? 'water')
    );

    insert into public.bunker_mission_decisions(
      event_id, run_nonce, instance_id, decision_key, actor_kind, actor_id,
      actor_scope_key, status, instance_version, command_id, payload, outcome, confirmed_at
    ) values (
      v_event_id, v_state.run_nonce, v_instance.id, 'm03_allocation', 'wagon', v_guest.id,
      v_guest.carriage_id::text, 'confirmed', v_instance.instance_version, p_command_id,
      jsonb_build_object('selection', v_selection), v_outcome, v_now
    );

    update public.bunker_mission_instances
    set status = 'completed', completed_at = v_now, outcome = v_outcome
    where id = v_instance.id;
    update public.bunker_mission_members
    set member_status = 'completed', updated_at = v_now
    where instance_id = v_instance.id;
  else
    raise exception 'unsupported M03 command type' using errcode = '22023';
  end if;

  v_result := jsonb_build_object(
    'contractVersion', 2, 'status', 'accepted',
    'commandId', p_command_id, 'commandType', p_command_type
  );
  insert into public.bunker_command_receipts(
    event_id, run_nonce, actor_kind, actor_id, command_id,
    command_type, request_hash, result
  ) values (
    v_event_id, v_state.run_nonce, 'guest', v_guest.id, p_command_id,
    p_command_type, v_request_hash, v_result
  );
  insert into public.bunker_game_events(
    event_id, run_nonce, carriage_id, guest_id, event_type, actor_type,
    actor_id, command_id, correlation_id, instance_id, schema_version, payload
  ) values (
    v_event_id, v_state.run_nonce, v_guest.carriage_id, v_guest.id,
    case when p_command_type='mission_confirm' then 'decision_confirmed' else 'ability_proposed' end,
    'guest', v_guest.id, p_command_id, p_command_id, v_instance.id, 2,
    jsonb_build_object('missionCode','MISSION_03','commandType',p_command_type)
  );
  return v_result;
end;
$$;
revoke all on function public._submit_bunker_command_m03(text,text,uuid,text,jsonb) from public, anon, authenticated;

create or replace function public.get_guest_bunker_v2_m03(p_event_slug text, p_device_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid; v_guest public.guests%rowtype; v_state public.bunker_state%rowtype;
  v_run public.bunker_game_runs%rowtype; v_instance public.bunker_mission_instances%rowtype;
  v_member public.bunker_mission_members%rowtype; v_profile public.bunker_guest_profiles%rowtype;
  v_wagon public.carriages%rowtype; v_inventory jsonb; v_commitments jsonb; v_selection jsonb := '[]'::jsonb;
  v_ability jsonb := null; v_problem text; v_now timestamptz := clock_timestamp();
begin
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);
  if v_event_id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;
  select g.* into v_guest from public.guests g where g.event_id=v_event_id and g.id=public._bunker_guest_id(p_event_slug,p_device_key);
  if v_guest.id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;
  select s.* into v_state from public.bunker_state s where s.event_id=v_event_id;
  if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;
  if v_run.contract_version<>2 then return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now); end if;
  select i.* into v_instance from public.bunker_mission_instances i where i.run_nonce=v_state.run_nonce and i.mission_code='MISSION_03' and i.scope_key=v_guest.carriage_id::text limit 1;
  if v_instance.id is null or v_state.global_game_state not in ('MISSION_03','MISSION_04','MISSION_05','MISSION_06','UNKNOWN_PASSENGER','BREAK_BEFORE_FINAL','FINAL_30','BUNKER_OPEN','FINISHED') then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select m.* into v_member from public.bunker_mission_members m where m.instance_id=v_instance.id and m.guest_id=v_guest.id;
  select p.* into v_profile from public.bunker_guest_profiles p where p.run_nonce=v_state.run_nonce and p.guest_id=v_guest.id;
  select c.* into v_wagon from public.carriages c where c.id=v_guest.carriage_id;
  select coalesce(jsonb_agg(jsonb_build_object('itemKey',lot.item_key,'quantity',sum_quantity,'status','available') order by lot.item_key),'[]'::jsonb)
  into v_inventory
  from (
    select item_key, sum(quantity)::integer as sum_quantity
    from public.bunker_inventory_lots
    where run_nonce=v_state.run_nonce and carriage_id=v_guest.carriage_id and status='available'
    group by item_key
  ) lot;
  select coalesce(jsonb_agg(jsonb_build_object('problemKey',u.problem_key,'status',u.status,'label',coalesce(u.effect->>'label','Способность пассажира')) order by u.created_at),'[]'::jsonb)
  into v_commitments from public.bunker_ability_uses u where u.instance_id=v_instance.id and u.status in ('pending','committed','rejected');
  select coalesce(d.payload->'selection','[]'::jsonb) into v_selection from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key='m03_allocation' limit 1;
  v_problem := public._bunker_v2_m03_problem_for_ability(v_profile.special_ability);
  if v_problem is not null then
    v_ability := jsonb_build_object(
      'available', v_profile.ability_uses_remaining > 0 and not exists(select 1 from public.bunker_ability_uses u where u.run_nonce=v_state.run_nonce and u.guest_id=v_guest.id and u.ability_key=v_profile.special_ability),
      'key', v_profile.special_ability, 'problemKey', v_problem,
      'label', v_profile.ability_description
    );
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'contractVersion',2,'status',case when v_instance.status='completed' then 'completed' else 'active' end,
    'serverNow',v_now,'deadlineAt',coalesce(v_instance.deadline_at,v_now),
    'instanceId',v_instance.id,'instanceVersion',v_instance.instance_version,
    'title',v_instance.definition->>'title','intro',v_instance.definition->>'intro',
    'wagon',jsonb_build_object('number',v_wagon.number,'label',v_wagon.label),
    'memberRole',case when v_member.member_role='captain' then 'captain' else 'member' end,
    'problems',v_instance.definition->'problems','inventory',v_inventory,
    'selectedProblems',v_selection,'ability',v_ability,'pendingCommitments',v_commitments,
    'outcome',v_instance.outcome
  ));
end;
$$;
revoke all on function public.get_guest_bunker_v2_m03(text,text) from public, anon, authenticated;
grant execute on function public.get_guest_bunker_v2_m03(text,text) to anon, authenticated;

create or replace function public._bunker_v2_m03_progress(p_event_id uuid, p_run_nonce uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'wagonId',i.scope_key,
    'label',c.label,
    'status',case when i.status='completed' then 'completed' else 'active' end,
    'solvedCount',coalesce((i.outcome->>'solvedCount')::integer,0)
  ) order by c.number),'[]'::jsonb)
  from public.bunker_mission_instances i
  join public.carriages c on c.id::text=i.scope_key and c.event_id=p_event_id
  where i.run_nonce=p_run_nonce and i.mission_code='MISSION_03';
$$;
revoke all on function public._bunker_v2_m03_progress(uuid,uuid) from public, anon, authenticated;

create or replace function public.get_bunker_v2_m03_screen(p_event_slug text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event_id uuid; v_state public.bunker_state%rowtype; v_run public.bunker_game_runs%rowtype; v_deadline timestamptz; v_now timestamptz:=clock_timestamp();
begin
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);
  if v_event_id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;
  select s.* into v_state from public.bunker_state s where s.event_id=v_event_id;
  if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;
  if v_run.contract_version<>2 then return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now); end if;
  select max(deadline_at) into v_deadline from public.bunker_mission_instances where run_nonce=v_state.run_nonce and mission_code='MISSION_03';
  return jsonb_build_object('contractVersion',2,'status',case when v_state.global_game_state='MISSION_03' then 'active' else 'completed' end,'serverNow',v_now,'deadlineAt',coalesce(v_deadline,v_now),'title','Аварийный запас','wagons',public._bunker_v2_m03_progress(v_event_id,v_state.run_nonce));
end;$$;
revoke all on function public.get_bunker_v2_m03_screen(text) from public,anon,authenticated; grant execute on function public.get_bunker_v2_m03_screen(text) to anon,authenticated;

create or replace function public.get_owner_bunker_v2_m03(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_state public.bunker_state%rowtype; v_deadline timestamptz; v_now timestamptz:=clock_timestamp();
begin
  perform public._require_bunker_owner(p_event_id); select s.* into v_state from public.bunker_state s where s.event_id=p_event_id;
  if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select max(deadline_at) into v_deadline from public.bunker_mission_instances where run_nonce=v_state.run_nonce and mission_code='MISSION_03';
  return jsonb_build_object('contractVersion',2,'status',case when v_state.global_game_state='MISSION_03' then 'active' else 'completed' end,'serverNow',v_now,'deadlineAt',coalesce(v_deadline,v_now),'title','Аварийный запас','wagons',public._bunker_v2_m03_progress(p_event_id,v_state.run_nonce));
end;$$;
revoke all on function public.get_owner_bunker_v2_m03(uuid) from public,anon,authenticated; grant execute on function public.get_owner_bunker_v2_m03(uuid) to authenticated;

create or replace function public._submit_bunker_command_m04(
  p_event_slug text,
  p_device_key text,
  p_command_id uuid,
  p_command_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid; v_guest public.guests%rowtype; v_state public.bunker_state%rowtype;
  v_run public.bunker_game_runs%rowtype; v_instance public.bunker_mission_instances%rowtype;
  v_member public.bunker_mission_members%rowtype; v_profile public.bunker_guest_profiles%rowtype;
  v_existing public.bunker_command_receipts%rowtype; v_transfer public.bunker_inventory_transfers%rowtype;
  v_source public.bunker_inventory_lots%rowtype; v_target public.carriages%rowtype;
  v_request_hash text; v_result jsonb; v_message text; v_message_count integer; v_quota integer;
  v_reserved integer; v_new_lot uuid; v_answer text; v_wagon_count integer; v_answered integer; v_distinct integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_command_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid M04 command' using errcode='22023'; end if;
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);
  if v_event_id is null then raise exception 'Bunker event not found' using errcode='P0002'; end if;
  select g.* into v_guest from public.guests g where g.event_id=v_event_id and g.id=public._bunker_guest_id(p_event_slug,p_device_key);
  if v_guest.id is null then raise exception 'registered Bunker guest required' using errcode='42501'; end if;
  select s.* into v_state from public.bunker_state s where s.event_id=v_event_id for update;
  if v_state.run_nonce is null then raise exception 'active Bunker V2 run required' using errcode='55000'; end if;
  select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;
  if v_run.contract_version<>2 then raise exception 'active Bunker V2 run required' using errcode='55000'; end if;
  v_request_hash:=encode(extensions.digest(convert_to(jsonb_build_object('commandType',p_command_type,'payload',p_payload)::text,'UTF8'),'sha256'),'hex');
  select r.* into v_existing from public.bunker_command_receipts r where r.run_nonce=v_state.run_nonce and r.actor_kind='guest' and r.actor_id=v_guest.id and r.command_id=p_command_id;
  if v_existing.id is not null then if v_existing.request_hash<>v_request_hash then raise exception 'idempotency_conflict' using errcode='55000'; end if; return v_existing.result; end if;
  if v_state.global_game_state<>'MISSION_04' then raise exception 'M04 is not the current Bunker V2 stage' using errcode='55000'; end if;
  begin
    select i.* into v_instance from public.bunker_mission_instances i
    where i.event_id=v_event_id and i.run_nonce=v_state.run_nonce and i.id=(p_payload->>'instanceId')::uuid
    for update;
  exception when invalid_text_representation then raise exception 'invalid M04 instance id' using errcode='22023'; end;
  if v_instance.id is null or v_instance.mission_code<>'MISSION_04' then raise exception 'M04 instance not found' using errcode='P0002'; end if;
  if not (v_instance.definition->'wagonIds' @> jsonb_build_array(v_guest.carriage_id)) then raise exception 'guest wagon is not in this M04 group' using errcode='42501'; end if;
  if v_instance.status<>'active' then raise exception 'M04 instance is not active' using errcode='55000'; end if;
  select m.* into v_member from public.bunker_mission_members m where m.instance_id=v_instance.id and m.guest_id=v_guest.id for update;
  if v_member.id is null then raise exception 'M04 frozen member required' using errcode='42501'; end if;
  select p.* into v_profile from public.bunker_guest_profiles p where p.run_nonce=v_state.run_nonce and p.guest_id=v_guest.id for update;

  if p_command_type='send_message' then
    if v_instance.definition->>'interactionPhase'<>'exchange' then raise exception 'M04 messages are closed' using errcode='55000'; end if;
    if v_member.member_role<>'operator' then raise exception 'M04 message requires wagon operator' using errcode='42501'; end if;
    v_message:=btrim(p_payload->>'message');
    if v_message is null or char_length(v_message)<1 or char_length(v_message)>120 then raise exception 'M04 message must be between 1 and 120 characters' using errcode='22023'; end if;
    if exists(select 1 from public.bunker_intercarriage_messages m where m.instance_id=v_instance.id and m.from_carriage_id=v_guest.carriage_id and m.created_at>v_now-interval '1 second') then raise exception 'M04 message rate limit' using errcode='55000'; end if;
    select count(*)::integer into v_message_count from public.bunker_intercarriage_messages m where m.instance_id=v_instance.id and m.from_carriage_id=v_guest.carriage_id;
    v_quota:=3;
    if v_message_count>=3 then
      if v_message_count<>3 or v_profile.special_ability<>'extra_message' or v_profile.ability_uses_remaining<1 or exists(select 1 from public.bunker_ability_uses u where u.run_nonce=v_state.run_nonce and u.guest_id=v_guest.id and u.ability_key='extra_message') then
        raise exception 'M04 message quota reached' using errcode='55000';
      end if;
      insert into public.bunker_ability_uses(event_id,run_nonce,instance_id,guest_id,ability_key,problem_key,status,command_id,effect,committed_at)
      values(v_event_id,v_state.run_nonce,v_instance.id,v_guest.id,'extra_message','communication','committed',p_command_id,jsonb_build_object('extraMessage',true),v_now);
      update public.bunker_guest_profiles set ability_uses_remaining=ability_uses_remaining-1,ability_used_at=v_now where run_nonce=v_state.run_nonce and guest_id=v_guest.id and ability_uses_remaining>0;
      v_quota:=4;
    end if;
    insert into public.bunker_intercarriage_messages(event_id,run_nonce,instance_id,group_key,from_carriage_id,from_guest_id,message,message_index)
    values(v_event_id,v_state.run_nonce,v_instance.id,v_instance.scope_key,v_guest.carriage_id,v_guest.id,v_message,v_message_count+1);

    select jsonb_array_length(v_instance.definition->'wagonIds') into v_wagon_count;
    if (select count(distinct m.from_carriage_id) from public.bunker_intercarriage_messages m where m.instance_id=v_instance.id) >= v_wagon_count then
      update public.bunker_mission_instances
      set definition=jsonb_set(definition,'{interactionPhase}','"answer"'::jsonb,true),
          instance_version=instance_version+1
      where id=v_instance.id;
    end if;

  elsif p_command_type='propose_trade' then
    if v_instance.definition->>'interactionPhase'<>'exchange' then raise exception 'M04 trades are closed' using errcode='55000'; end if;
    if v_member.member_role<>'operator' then raise exception 'M04 trade requires wagon operator' using errcode='42501'; end if;
    select c.* into v_target from public.carriages c where c.event_id=v_event_id and c.number=(p_payload->>'targetWagonNumber')::integer;
    if v_target.id is null or v_target.id=v_guest.carriage_id or not (v_instance.definition->'wagonIds' @> jsonb_build_array(v_target.id)) then raise exception 'M04 target wagon is outside the group' using errcode='22023'; end if;
    if coalesce((p_payload->>'quantity')::integer,0)<1 then raise exception 'invalid M04 trade quantity' using errcode='22023'; end if;

    select lot.* into v_source
    from public.bunker_inventory_lots lot
    where lot.run_nonce=v_state.run_nonce and lot.carriage_id=v_guest.carriage_id
      and lot.item_key=p_payload->>'itemKey' and lot.status='available'
      and lot.quantity - coalesce((select sum(t.quantity) from public.bunker_inventory_transfers t where t.source_lot_id=lot.id and t.status='proposed'),0) >= (p_payload->>'quantity')::integer
    order by lot.acquired_at,lot.id limit 1 for update;
    if v_source.id is null then raise exception 'M04 source inventory is unavailable' using errcode='55000'; end if;
    select coalesce(sum(t.quantity),0)::integer into v_reserved from public.bunker_inventory_transfers t where t.source_lot_id=v_source.id and t.status='proposed';
    if v_source.quantity-v_reserved<(p_payload->>'quantity')::integer then raise exception 'M04 source inventory changed concurrently' using errcode='40001'; end if;
    insert into public.bunker_inventory_transfers(event_id,run_nonce,instance_id,source_lot_id,from_carriage_id,to_carriage_id,proposed_by_guest_id,item_key,quantity,status,command_id)
    values(v_event_id,v_state.run_nonce,v_instance.id,v_source.id,v_guest.carriage_id,v_target.id,v_guest.id,v_source.item_key,(p_payload->>'quantity')::integer,'proposed',p_command_id);

  elsif p_command_type='respond_trade' then
    if v_member.member_role<>'operator' then raise exception 'M04 trade response requires wagon operator' using errcode='42501'; end if;
    begin
      select t.* into v_transfer from public.bunker_inventory_transfers t
      where t.event_id=v_event_id and t.run_nonce=v_state.run_nonce and t.instance_id=v_instance.id and t.id=(p_payload->>'transferId')::uuid
      for update;
    exception when invalid_text_representation then raise exception 'invalid M04 transfer id' using errcode='22023'; end;
    if v_transfer.id is null or v_transfer.to_carriage_id<>v_guest.carriage_id then raise exception 'M04 incoming trade not found' using errcode='42501'; end if;
    if v_transfer.status<>'proposed' then raise exception 'M04 trade is already settled' using errcode='55000'; end if;
    if p_payload->>'response'='reject' then
      update public.bunker_inventory_transfers set status='rejected',settled_at=v_now where id=v_transfer.id;
    elsif p_payload->>'response'='accept' then
      select lot.* into v_source from public.bunker_inventory_lots lot where lot.id=v_transfer.source_lot_id for update;
      if v_source.id is null or v_source.status<>'available' or v_source.quantity<v_transfer.quantity then
        update public.bunker_inventory_transfers set status='expired',settled_at=v_now where id=v_transfer.id;
      else
        if v_source.quantity=v_transfer.quantity then
          update public.bunker_inventory_lots set status='transferred',transferred_to=v_transfer.to_carriage_id,metadata=metadata||jsonb_build_object('transferId',v_transfer.id) where id=v_source.id;
        else
          update public.bunker_inventory_lots set quantity=quantity-v_transfer.quantity,metadata=metadata||jsonb_build_object('lastTransferId',v_transfer.id) where id=v_source.id and quantity-v_transfer.quantity>0;
          if not found then raise exception 'M04 inventory changed concurrently' using errcode='40001'; end if;
        end if;
        insert into public.bunker_inventory_lots(event_id,run_nonce,carriage_id,item_key,quantity,status,source_lot_id,metadata)
        values(v_event_id,v_state.run_nonce,v_transfer.to_carriage_id,v_transfer.item_key,v_transfer.quantity,'available',v_source.id,jsonb_build_object('transferId',v_transfer.id,'fromCarriageId',v_transfer.from_carriage_id))
        returning id into v_new_lot;
        update public.bunker_inventory_transfers set status='accepted',accepted_lot_id=v_new_lot,settled_at=v_now where id=v_transfer.id;
      end if;
    else raise exception 'invalid M04 trade response' using errcode='22023'; end if;

  elsif p_command_type='use_ability' then
    if v_profile.special_ability<>'clarification' or v_profile.ability_uses_remaining<1 then raise exception 'M04 clarification is unavailable' using errcode='42501'; end if;
    insert into public.bunker_ability_uses(event_id,run_nonce,instance_id,guest_id,ability_key,problem_key,status,command_id,effect,committed_at)
    values(v_event_id,v_state.run_nonce,v_instance.id,v_guest.id,'clarification','communication','committed',p_command_id,jsonb_build_object('hint','Сравните формулировки вагонов: совпасть должен именно общий приоритет, а не отдельная деталь.'),v_now);
    update public.bunker_guest_profiles set ability_uses_remaining=ability_uses_remaining-1,ability_used_at=v_now where run_nonce=v_state.run_nonce and guest_id=v_guest.id and ability_uses_remaining>0;

  elsif p_command_type='submit_answer' then
    if v_instance.definition->>'interactionPhase'<>'answer' then raise exception 'M04 answer phase is not active' using errcode='55000'; end if;
    if jsonb_typeof(p_payload->'answers')<>'array' or jsonb_array_length(p_payload->'answers')<>1 then raise exception 'M04 requires one group answer' using errcode='22023'; end if;
    v_answer:=btrim(p_payload#>>'{answers,0}');
    if not exists(select 1 from jsonb_array_elements_text(v_instance.definition->'answerOptions') option(value) where option.value=v_answer) then raise exception 'invalid M04 answer' using errcode='22023'; end if;

    insert into public.bunker_mission_decisions(event_id,run_nonce,instance_id,decision_key,actor_kind,actor_id,actor_scope_key,status,instance_version,command_id,payload,outcome,confirmed_at)
    values(v_event_id,v_state.run_nonce,v_instance.id,'m04_answer','wagon',v_guest.id,v_guest.carriage_id::text,'confirmed',v_instance.instance_version,p_command_id,jsonb_build_object('answer',v_answer),jsonb_build_object('answer',v_answer),v_now)
    on conflict (instance_id,decision_key,actor_kind,actor_scope_key)
    do update set actor_id=excluded.actor_id,status='confirmed',instance_version=excluded.instance_version,command_id=excluded.command_id,payload=excluded.payload,outcome=excluded.outcome,confirmed_at=excluded.confirmed_at;

    select jsonb_array_length(v_instance.definition->'wagonIds') into v_wagon_count;
    select count(*)::integer,count(distinct lower(btrim(d.payload->>'answer')))::integer into v_answered,v_distinct
    from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key='m04_answer' and d.actor_kind='wagon' and d.status='confirmed';
    if v_answered=v_wagon_count and v_distinct=1 then
      update public.bunker_mission_instances set status='completed',completed_at=v_now,outcome=jsonb_build_object('status','consensus','answer',v_answer),definition=jsonb_set(definition,'{interactionPhase}','"resolved"'::jsonb,true) where id=v_instance.id;
      update public.bunker_mission_members set member_status='completed',updated_at=v_now where instance_id=v_instance.id;
    end if;
  else
    raise exception 'unsupported M04 command type' using errcode='22023';
  end if;

  v_result:=jsonb_build_object('contractVersion',2,'status','accepted','commandId',p_command_id,'commandType',p_command_type);
  insert into public.bunker_command_receipts(event_id,run_nonce,actor_kind,actor_id,command_id,command_type,request_hash,result)
  values(v_event_id,v_state.run_nonce,'guest',v_guest.id,p_command_id,p_command_type,v_request_hash,v_result);
  insert into public.bunker_game_events(event_id,run_nonce,carriage_id,guest_id,event_type,actor_type,actor_id,command_id,correlation_id,instance_id,schema_version,payload)
  values(v_event_id,v_state.run_nonce,v_guest.carriage_id,v_guest.id,'m04_'||p_command_type,'guest',v_guest.id,p_command_id,p_command_id,v_instance.id,2,jsonb_build_object('missionCode','MISSION_04','commandType',p_command_type));
  return v_result;
end;
$$;
revoke all on function public._submit_bunker_command_m04(text,text,uuid,text,jsonb) from public,anon,authenticated;

-- Public router first checks receipts, so an exact retry remains valid even if
-- the owner already advanced to the next stage after the original response was lost.
create or replace function public.submit_bunker_command(
  p_event_slug text,p_device_key text,p_command_id uuid,p_command_type text,p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_event_id uuid; v_guest_id uuid; v_state public.bunker_state%rowtype;
  v_existing public.bunker_command_receipts%rowtype; v_hash text; v_instance_id uuid;
begin
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);
  if v_event_id is null then raise exception 'Bunker event not found' using errcode='P0002'; end if;
  v_guest_id:=public._bunker_guest_id(p_event_slug,p_device_key);
  if v_guest_id is null then raise exception 'registered Bunker guest required' using errcode='42501'; end if;
  select s.* into v_state from public.bunker_state s where s.event_id=v_event_id for update;
  if v_state.run_nonce is null then raise exception 'active Bunker V2 run required' using errcode='55000'; end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('commandType',p_command_type,'payload',p_payload)::text,'UTF8'),'sha256'),'hex');
  select r.* into v_existing from public.bunker_command_receipts r where r.run_nonce=v_state.run_nonce and r.actor_kind='guest' and r.actor_id=v_guest_id and r.command_id=p_command_id;
  if v_existing.id is not null then if v_existing.request_hash<>v_hash then raise exception 'idempotency_conflict' using errcode='55000'; end if; return v_existing.result; end if;

  if v_state.global_game_state='MISSION_01' then
    begin v_instance_id:=(p_payload->>'instanceId')::uuid; exception when others then v_instance_id:=null; end;
    perform 1 from public.bunker_mission_instances i where i.id=v_instance_id for update;
    perform 1 from public.bunker_mission_members m where m.instance_id=v_instance_id order by m.id for update;
    return public._submit_bunker_command_m01(p_event_slug,p_device_key,p_command_id,p_command_type,p_payload);
  elsif v_state.global_game_state='MISSION_02' then
    return public._submit_bunker_command_m02(p_event_slug,p_device_key,p_command_id,p_command_type,p_payload);
  elsif v_state.global_game_state='MISSION_03' then
    return public._submit_bunker_command_m03(p_event_slug,p_device_key,p_command_id,p_command_type,p_payload);
  elsif v_state.global_game_state='MISSION_04' then
    return public._submit_bunker_command_m04(p_event_slug,p_device_key,p_command_id,p_command_type,p_payload);
  end if;
  raise exception 'Bunker command is unavailable at current stage' using errcode='55000';
end;
$$;
revoke all on function public.submit_bunker_command(text,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_bunker_command(text,text,uuid,text,jsonb) to anon,authenticated;

create or replace function public.get_guest_bunker_v2_m04(p_event_slug text,p_device_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_event_id uuid; v_guest public.guests%rowtype; v_state public.bunker_state%rowtype;
  v_run public.bunker_game_runs%rowtype; v_instance public.bunker_mission_instances%rowtype;
  v_member public.bunker_mission_members%rowtype; v_profile public.bunker_guest_profiles%rowtype;
  v_group_wagons jsonb; v_messages jsonb; v_inventory jsonb; v_trades jsonb; v_answer text;
  v_answered integer; v_total integer; v_quota integer; v_message_count integer; v_ability jsonb:=null;
  v_now timestamptz:=clock_timestamp();
begin
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);
  if v_event_id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;
  select g.* into v_guest from public.guests g where g.event_id=v_event_id and g.id=public._bunker_guest_id(p_event_slug,p_device_key);
  if v_guest.id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;
  select s.* into v_state from public.bunker_state s where s.event_id=v_event_id;
  if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;
  if v_run.contract_version<>2 then return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now); end if;
  select i.* into v_instance from public.bunker_mission_instances i where i.run_nonce=v_state.run_nonce and i.mission_code='MISSION_04' and i.definition->'wagonIds' @> jsonb_build_array(v_guest.carriage_id) limit 1;
  if v_instance.id is null or v_state.global_game_state not in ('MISSION_04','MISSION_05','MISSION_06','UNKNOWN_PASSENGER','BREAK_BEFORE_FINAL','FINAL_30','BUNKER_OPEN','FINISHED') then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select m.* into v_member from public.bunker_mission_members m where m.instance_id=v_instance.id and m.guest_id=v_guest.id;
  select p.* into v_profile from public.bunker_guest_profiles p where p.run_nonce=v_state.run_nonce and p.guest_id=v_guest.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'number',c.number,'label',c.label) order by c.number),'[]'::jsonb) into v_group_wagons from public.carriages c where c.id in (select value::uuid from jsonb_array_elements_text(v_instance.definition->'wagonIds'));
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'fromWagonLabel',c.label,'senderName',g.real_name,'message',m.message,'createdAt',m.created_at) order by m.created_at),'[]'::jsonb) into v_messages from public.bunker_intercarriage_messages m join public.carriages c on c.id=m.from_carriage_id join public.guests g on g.id=m.from_guest_id where m.instance_id=v_instance.id;
  select coalesce(jsonb_agg(jsonb_build_object('itemKey',x.item_key,'quantity',x.qty) order by x.item_key),'[]'::jsonb) into v_inventory from (select item_key,sum(quantity)::integer qty from public.bunker_inventory_lots where run_nonce=v_state.run_nonce and carriage_id=v_guest.carriage_id and status='available' group by item_key)x;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'direction',case when t.to_carriage_id=v_guest.carriage_id then 'incoming' else 'outgoing' end,'otherWagonLabel',case when t.to_carriage_id=v_guest.carriage_id then from_c.label else to_c.label end,'itemKey',t.item_key,'quantity',t.quantity,'status',t.status) order by t.offered_at desc),'[]'::jsonb) into v_trades from public.bunker_inventory_transfers t join public.carriages from_c on from_c.id=t.from_carriage_id join public.carriages to_c on to_c.id=t.to_carriage_id where t.instance_id=v_instance.id and (t.from_carriage_id=v_guest.carriage_id or t.to_carriage_id=v_guest.carriage_id);
  select d.payload->>'answer' into v_answer from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key='m04_answer' and d.actor_kind='wagon' and d.actor_scope_key=v_guest.carriage_id::text limit 1;
  select count(*)::integer into v_answered from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key='m04_answer' and d.status='confirmed';
  v_total:=jsonb_array_length(v_instance.definition->'wagonIds');
  select count(*)::integer into v_message_count from public.bunker_intercarriage_messages m where m.instance_id=v_instance.id and m.from_carriage_id=v_guest.carriage_id;
  v_quota:=case when v_profile.special_ability='extra_message' and (v_profile.ability_uses_remaining>0 or exists(select 1 from public.bunker_ability_uses u where u.instance_id=v_instance.id and u.guest_id=v_guest.id and u.ability_key='extra_message')) then 4 else 3 end;
  if v_profile.special_ability='clarification' then v_ability:=jsonb_build_object('available',v_profile.ability_uses_remaining>0 and not exists(select 1 from public.bunker_ability_uses u where u.run_nonce=v_state.run_nonce and u.guest_id=v_guest.id and u.ability_key='clarification'),'key','clarification','label','Уточнение сообщения','hint',coalesce((select u.effect->>'hint' from public.bunker_ability_uses u where u.instance_id=v_instance.id and u.guest_id=v_guest.id and u.ability_key='clarification' limit 1),'Можно один раз получить подсказку, как сверить формулировки вагонов.')); end if;
  return jsonb_build_object('contractVersion',2,'status',case when v_instance.status='completed' then 'completed' else 'active' end,'serverNow',v_now,'deadlineAt',coalesce(v_instance.deadline_at,v_now),'instanceId',v_instance.id,'instanceVersion',v_instance.instance_version,'title',v_instance.definition->>'title','interactionPhase',coalesce(v_instance.definition->>'interactionPhase','exchange'),'group',jsonb_build_object('key',v_instance.scope_key,'wagons',v_group_wagons),'viewer',jsonb_build_object('wagonId',v_guest.carriage_id,'wagonNumber',(select c.number from public.carriages c where c.id=v_guest.carriage_id),'isOperator',v_member.member_role='operator'),'messageQuota',v_quota,'messagesRemaining',greatest(0,v_quota-v_message_count),'messages',v_messages,'inventory',v_inventory,'trades',v_trades,'answer',jsonb_build_object('options',v_instance.definition->'answerOptions','selected',v_answer,'answeredWagons',v_answered,'totalWagons',v_total),'ability',v_ability);
end;$$;
revoke all on function public.get_guest_bunker_v2_m04(text,text) from public,anon,authenticated; grant execute on function public.get_guest_bunker_v2_m04(text,text) to anon,authenticated;

create or replace function public._bunker_v2_m04_progress(p_event_id uuid,p_run_nonce uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'groupKey',i.scope_key,
    'labels',(select jsonb_agg(c.label order by c.number) from public.carriages c where c.id in (select value::uuid from jsonb_array_elements_text(i.definition->'wagonIds'))),
    'phase',coalesce(i.definition->>'interactionPhase','exchange'),
    'answeredWagons',(select count(*) from public.bunker_mission_decisions d where d.instance_id=i.id and d.decision_key='m04_answer' and d.status='confirmed'),
    'totalWagons',jsonb_array_length(i.definition->'wagonIds'),
    'tradeCount',(select count(*) from public.bunker_inventory_transfers t where t.instance_id=i.id and t.status='accepted')
  ) order by i.scope_key),'[]'::jsonb)
  from public.bunker_mission_instances i where i.event_id=p_event_id and i.run_nonce=p_run_nonce and i.mission_code='MISSION_04';
$$;
revoke all on function public._bunker_v2_m04_progress(uuid,uuid) from public,anon,authenticated;

create or replace function public.get_bunker_v2_m04_screen(p_event_slug text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event_id uuid;v_state public.bunker_state%rowtype;v_run public.bunker_game_runs%rowtype;v_deadline timestamptz;v_now timestamptz:=clock_timestamp();begin
select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);if v_event_id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now);end if;select s.* into v_state from public.bunker_state s where s.event_id=v_event_id;if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);end if;select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;if v_run.contract_version<>2 then return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now);end if;select max(deadline_at) into v_deadline from public.bunker_mission_instances where run_nonce=v_state.run_nonce and mission_code='MISSION_04';return jsonb_build_object('contractVersion',2,'status',case when v_state.global_game_state='MISSION_04' then 'active' else 'completed' end,'serverNow',v_now,'deadlineAt',coalesce(v_deadline,v_now),'title','Межвагонная связь','groups',public._bunker_v2_m04_progress(v_event_id,v_state.run_nonce));end;$$;
revoke all on function public.get_bunker_v2_m04_screen(text) from public,anon,authenticated;grant execute on function public.get_bunker_v2_m04_screen(text) to anon,authenticated;

create or replace function public.get_owner_bunker_v2_m04(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_state public.bunker_state%rowtype;v_deadline timestamptz;v_now timestamptz:=clock_timestamp();begin perform public._require_bunker_owner(p_event_id);select s.* into v_state from public.bunker_state s where s.event_id=p_event_id;if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);end if;select max(deadline_at) into v_deadline from public.bunker_mission_instances where run_nonce=v_state.run_nonce and mission_code='MISSION_04';return jsonb_build_object('contractVersion',2,'status',case when v_state.global_game_state='MISSION_04' then 'active' else 'completed' end,'serverNow',v_now,'deadlineAt',coalesce(v_deadline,v_now),'title','Межвагонная связь','groups',public._bunker_v2_m04_progress(p_event_id,v_state.run_nonce));end;$$;
revoke all on function public.get_owner_bunker_v2_m04(uuid) from public,anon,authenticated;grant execute on function public.get_owner_bunker_v2_m04(uuid) to authenticated;
