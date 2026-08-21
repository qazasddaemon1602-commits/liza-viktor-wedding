create or replace function public.get_guest_bunker_v2_m01(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_guest public.guests%rowtype;
  v_carriage public.carriages%rowtype;
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_instance public.bunker_mission_instances%rowtype;
  v_members jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp();
begin
  select event.id
  into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'not_found', 'serverNow', v_now
    );
  end if;

  select guest.*
  into v_guest
  from public.guests guest
  where guest.event_id = v_event_id
    and guest.id = public._bunker_guest_id(p_event_slug, p_device_key);
  if v_guest.id is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'guest_not_found', 'serverNow', v_now
    );
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = v_event_id;
  if v_state.run_nonce is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_state.run_nonce;
  if v_contract_version is distinct from 2 or v_state.global_game_state <> 'MISSION_01' then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  select carriage.*
  into v_carriage
  from public.carriages carriage
  where carriage.event_id = v_event_id and carriage.id = v_guest.carriage_id;
  if v_carriage.id is null then
    raise exception 'Bunker M01 guest wagon is missing' using errcode = '55000';
  end if;

  select instance.*
  into v_instance
  from public.bunker_mission_instances instance
  where instance.event_id = v_event_id
    and instance.run_nonce = v_state.run_nonce
    and instance.mission_code = 'MISSION_01'
    and instance.scope_kind = 'wagon'
    and instance.scope_key = v_carriage.id::text;
  if v_instance.id is null or v_instance.status not in ('active', 'completed') then
    raise exception 'Bunker M01 guest instance is unavailable' using errcode = '55000';
  end if;
  if v_instance.deadline_at is null then
    raise exception 'Bunker M01 guest deadline is missing' using errcode = '55000';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'guestId', member.guest_id,
        'realName', concat_ws(' ', guest.first_name, guest.last_name),
        'profession', profile.profession,
        'health', profile.health,
        'visibleSkill', profile.visible_skill
      ) order by guest.registered_at, guest.id
    ),
    '[]'::jsonb
  )
  into v_members
  from public.bunker_mission_members member
  join public.guests guest
    on guest.event_id = member.event_id and guest.id = member.guest_id
  join public.bunker_guest_profiles profile
    on profile.event_id = member.event_id
   and profile.run_nonce = member.run_nonce
   and profile.guest_id = member.guest_id
  where member.instance_id = v_instance.id;

  return jsonb_build_object(
    'contractVersion', 2,
    'status', v_instance.status,
    'serverNow', v_now,
    'instanceId', v_instance.id,
    'instanceVersion', v_instance.instance_version,
    'deadlineAt', v_instance.deadline_at,
    'wagon', jsonb_build_object(
      'id', v_carriage.id,
      'number', v_carriage.number,
      'label', v_carriage.label
    ),
    'quota', (v_instance.definition->>'quota')::integer,
    'members', v_members,
    'selectedGuestIds', case
      when v_instance.status = 'completed'
        then coalesce(v_instance.outcome->'selectedGuestIds', '[]'::jsonb)
      else '[]'::jsonb
    end
  );
end;
$$;

create or replace function public.get_owner_bunker_v2_m01(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_wagons jsonb := '[]'::jsonb;
  v_deadline timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if v_owner is null or not exists (
    select 1
    from public.events event
    where event.id = p_event_id and event.owner_user_id = v_owner
  ) then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = p_event_id;
  if v_state.run_nonce is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = v_state.run_nonce;
  if v_contract_version = 1 then
    return jsonb_build_object(
      'contractVersion', 1, 'status', 'legacy', 'serverNow', v_now
    );
  end if;
  if v_contract_version is distinct from 2 or v_state.global_game_state <> 'MISSION_01' then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  select
    coalesce(jsonb_agg(wagon.model order by wagon.number), '[]'::jsonb),
    max(wagon.deadline_at)
  into v_wagons, v_deadline
  from (
    select
      carriage.number,
      instance.deadline_at,
      jsonb_build_object(
        'wagonId', carriage.id,
        'instanceId', instance.id,
        'instanceVersion', instance.instance_version,
        'label', carriage.label,
        'quota', (instance.definition->>'quota')::integer,
        'status', case when instance.status = 'completed' then 'completed' else 'active' end,
        'selectedGuestIds', case
          when instance.status = 'completed'
            then coalesce(instance.outcome->'selectedGuestIds', '[]'::jsonb)
          else '[]'::jsonb
        end,
        'members', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'guestId', member.guest_id,
              'realName', concat_ws(' ', guest.first_name, guest.last_name),
              'profession', profile.profession
            ) order by guest.registered_at, guest.id
          )
          from public.bunker_mission_members member
          join public.guests guest
            on guest.event_id = member.event_id and guest.id = member.guest_id
          join public.bunker_guest_profiles profile
            on profile.event_id = member.event_id
           and profile.run_nonce = member.run_nonce
           and profile.guest_id = member.guest_id
          where member.instance_id = instance.id
        ), '[]'::jsonb)
      ) as model
    from public.bunker_mission_instances instance
    join public.carriages carriage
      on carriage.event_id = instance.event_id
     and carriage.id::text = instance.scope_key
    where instance.event_id = p_event_id
      and instance.run_nonce = v_state.run_nonce
      and instance.mission_code = 'MISSION_01'
      and instance.scope_kind = 'wagon'
      and instance.status in ('active', 'completed')
  ) wagon;

  if jsonb_array_length(v_wagons) not between 2 and 5 or v_deadline is null then
    raise exception 'Bunker M01 owner projection is incomplete' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'contractVersion', 2,
    'status', 'active',
    'serverNow', v_now,
    'deadlineAt', v_deadline,
    'wagons', v_wagons
  );
end;
$$;

create or replace function public.get_bunker_v2_m01_screen(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_wagons jsonb := '[]'::jsonb;
  v_deadline timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  select event.id
  into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'not_found', 'serverNow', v_now
    );
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = v_event_id;
  if v_state.run_nonce is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_state.run_nonce;
  if v_contract_version is distinct from 2 or v_state.global_game_state <> 'MISSION_01' then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'wagonId', carriage.id,
        'label', carriage.label,
        'status', case when instance.status = 'completed' then 'completed' else 'active' end
      ) order by carriage.number
    ), '[]'::jsonb),
    max(instance.deadline_at)
  into v_wagons, v_deadline
  from public.bunker_mission_instances instance
  join public.carriages carriage
    on carriage.event_id = instance.event_id
   and carriage.id::text = instance.scope_key
  where instance.event_id = v_event_id
    and instance.run_nonce = v_state.run_nonce
    and instance.mission_code = 'MISSION_01'
    and instance.scope_kind = 'wagon'
    and instance.status in ('active', 'completed');

  if jsonb_array_length(v_wagons) not between 2 and 5 or v_deadline is null then
    raise exception 'Bunker M01 public projection is incomplete' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'contractVersion', 2,
    'status', 'active',
    'serverNow', v_now,
    'deadlineAt', v_deadline,
    'title', 'Лишний пассажир',
    'publicSummary', 'Вагоны изучают открытые части досье и принимают командное решение.',
    'wagons', v_wagons
  );
end;
$$;

create or replace function public.owner_override_bunker_v2_m01(
  p_event_id uuid,
  p_instance_id uuid,
  p_instance_version integer,
  p_command_id uuid,
  p_selected_guest_ids uuid[],
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_instance public.bunker_mission_instances%rowtype;
  v_existing_receipt public.bunker_command_receipts%rowtype;
  v_quota integer;
  v_selected_count integer;
  v_saved_ids uuid[];
  v_request_hash text;
  v_outcome jsonb;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if p_command_id is null
    or p_instance_id is null
    or p_instance_version is null
    or p_selected_guest_ids is null
    or coalesce(btrim(p_reason), '') = ''
    or length(btrim(p_reason)) > 500
  then
    raise exception 'M01 owner override requires instance, selection and reason'
      using errcode = '22023';
  end if;
  if v_owner is null or not exists (
    select 1
    from public.events event
    where event.id = p_event_id and event.owner_user_id = v_owner
  ) then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = p_event_id
  for update;
  if v_state.run_nonce is null or v_state.global_game_state <> 'MISSION_01' then
    raise exception 'M01 is not the current Bunker V2 stage' using errcode = '55000';
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = v_state.run_nonce;
  if v_contract_version is distinct from 2 then
    raise exception 'M01 owner override requires contract version 2' using errcode = '55000';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'commandType', 'owner_m01_override',
        'instanceId', p_instance_id,
        'instanceVersion', p_instance_version,
        'selectedGuestIds', to_jsonb(p_selected_guest_ids),
        'reason', btrim(p_reason)
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  select receipt.*
  into v_existing_receipt
  from public.bunker_command_receipts receipt
  where receipt.event_id = p_event_id
    and receipt.run_nonce = v_state.run_nonce
    and receipt.actor_kind = 'owner'
    and receipt.actor_id = v_owner
    and receipt.command_id = p_command_id;
  if v_existing_receipt.id is not null then
    if v_existing_receipt.request_hash <> v_request_hash then
      raise exception 'idempotency_conflict' using errcode = '55000';
    end if;
    return v_existing_receipt.result;
  end if;

  select instance.*
  into v_instance
  from public.bunker_mission_instances instance
  where instance.event_id = p_event_id
    and instance.run_nonce = v_state.run_nonce
    and instance.id = p_instance_id
  for update;
  if v_instance.id is null
    or v_instance.mission_code <> 'MISSION_01'
    or v_instance.scope_kind <> 'wagon'
  then
    raise exception 'M01 owner instance not found' using errcode = 'P0002';
  end if;
  if v_instance.status <> 'completed' then
    raise exception 'M01 owner override requires a completed decision' using errcode = '55000';
  end if;
  if v_instance.instance_version <> p_instance_version then
    raise exception 'M01 instance version changed' using errcode = '55000';
  end if;

  perform 1
  from public.bunker_mission_members member
  where member.instance_id = v_instance.id
  order by member.id
  for update;

  v_quota := (v_instance.definition->>'quota')::integer;
  v_selected_count := cardinality(p_selected_guest_ids);
  if v_quota is null
    or v_selected_count <> v_quota
    or exists (select 1 from unnest(p_selected_guest_ids) selected(id) where selected.id is null)
    or (select count(distinct selected.id) from unnest(p_selected_guest_ids) selected(id))
      <> v_selected_count
  then
    raise exception 'M01 owner selection must exactly match frozen quota'
      using errcode = '22023';
  end if;
  if (
    select count(*)
    from public.bunker_mission_members member
    where member.instance_id = v_instance.id
      and member.guest_id = any(p_selected_guest_ids)
  ) <> v_selected_count then
    raise exception 'M01 owner selection must contain only frozen members'
      using errcode = '42501';
  end if;

  select array_agg(member.guest_id order by member.guest_id)
  into v_saved_ids
  from public.bunker_mission_members member
  where member.instance_id = v_instance.id
    and not (member.guest_id = any(p_selected_guest_ids));

  v_outcome := jsonb_build_object(
    'contractVersion', 2,
    'status', 'completed',
    'selectedGuestIds', to_jsonb(p_selected_guest_ids),
    'savedGuestIds', to_jsonb(coalesce(v_saved_ids, array[]::uuid[])),
    'overriddenByOwner', true,
    'overrideReason', btrim(p_reason)
  );

  update public.bunker_guest_profiles profile
  set character_status = case
        when profile.guest_id = any(p_selected_guest_ids) then 'excluded'
        else 'saved'
      end,
      hidden_trait_revealed = true
  where profile.run_nonce = v_state.run_nonce
    and exists (
      select 1
      from public.bunker_mission_members member
      where member.instance_id = v_instance.id and member.guest_id = profile.guest_id
    );

  update public.bunker_mission_instances instance
  set instance_version = instance.instance_version + 1,
      outcome = v_outcome,
      completed_at = v_now
  where instance.id = v_instance.id;

  insert into public.bunker_mission_decisions(
    event_id, run_nonce, instance_id, decision_key, actor_kind, actor_id,
    actor_scope_key, status, instance_version, command_id, payload, outcome,
    confirmed_at
  ) values (
    p_event_id,
    v_state.run_nonce,
    v_instance.id,
    'm01_owner_override_' || (v_instance.instance_version + 1)::text,
    'owner',
    v_owner,
    v_instance.scope_key,
    'confirmed',
    v_instance.instance_version + 1,
    p_command_id,
    jsonb_build_object(
      'selectedGuestIds', to_jsonb(p_selected_guest_ids),
      'reason', btrim(p_reason)
    ),
    v_outcome,
    v_now
  );

  v_result := jsonb_build_object(
    'contractVersion', 2,
    'status', 'accepted',
    'commandId', p_command_id,
    'commandType', 'owner_m01_override'
  );

  insert into public.bunker_command_receipts(
    event_id, run_nonce, actor_kind, actor_id, command_id, command_type,
    request_hash, result
  ) values (
    p_event_id, v_state.run_nonce, 'owner', v_owner, p_command_id,
    'owner_m01_override', v_request_hash, v_result
  );

  insert into public.bunker_game_events(
    event_id, run_nonce, carriage_id, event_type, actor_type, actor_id,
    command_id, correlation_id, instance_id, schema_version, payload
  ) values (
    p_event_id,
    v_state.run_nonce,
    v_instance.scope_key::uuid,
    'owner_m01_override',
    'owner',
    v_owner,
    p_command_id,
    p_command_id,
    v_instance.id,
    2,
    jsonb_build_object(
      'reason', btrim(p_reason),
      'selectedCount', v_quota,
      'previousInstanceVersion', v_instance.instance_version,
      'instanceVersion', v_instance.instance_version + 1
    )
  );

  return v_result;
end;
$$;

revoke all on function public.get_guest_bunker_v2_m01(text, text)
  from public, anon, authenticated;
revoke all on function public.get_owner_bunker_v2_m01(uuid)
  from public, anon, authenticated;
revoke all on function public.get_bunker_v2_m01_screen(text)
  from public, anon, authenticated;
revoke all on function public.owner_override_bunker_v2_m01(
  uuid, uuid, integer, uuid, uuid[], text
) from public, anon, authenticated;

grant execute on function public.get_guest_bunker_v2_m01(text, text)
  to anon, authenticated;
grant execute on function public.get_bunker_v2_m01_screen(text)
  to anon, authenticated;
grant execute on function public.get_owner_bunker_v2_m01(uuid)
  to authenticated;
grant execute on function public.owner_override_bunker_v2_m01(
  uuid, uuid, integer, uuid, uuid[], text
) to authenticated;
