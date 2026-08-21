-- Registration must serialize ticket allocation without conflicting with the
-- KEY SHARE locks taken by event-FK child writes in state-first V2 commands.
create or replace function public.register_guest(
  p_event_slug text,
  p_device_key text,
  p_first_name text,
  p_last_name text,
  p_affiliation_type text,
  p_affiliation_detail text default null,
  p_confirm_duplicate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_hash text;
  v_existing_guest_id uuid;
  v_duplicate_guest_id uuid;
  v_carriage_id uuid;
  v_ticket_sequence bigint;
  v_ticket_number text;
  v_guest_id uuid;
  v_guest_count integer;
  v_first_name text := public._normalize_spaces(p_first_name);
  v_last_name text := public._normalize_spaces(p_last_name);
  v_detail text := nullif(public._normalize_spaces(p_affiliation_detail), '');
begin
  if length(coalesce(p_device_key, '')) < 8 then
    raise exception 'invalid device key' using errcode = '22023';
  end if;
  if v_first_name = '' then
    raise exception 'first name is required' using errcode = '22023';
  end if;
  if v_last_name = '' then
    raise exception 'last name is required' using errcode = '22023';
  end if;
  if p_affiliation_type not in ('liza', 'viktor', 'common', 'family', 'colleagues', 'other') then
    raise exception 'invalid affiliation type' using errcode = '22023';
  end if;

  select * into v_event
  from public.events
  where slug = public._normalize_spaces(p_event_slug)
  for no key update;

  if v_event.id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  v_hash := public._device_hash(p_device_key);

  select guest_id into v_existing_guest_id
  from public.guest_device_bindings
  where event_id = v_event.id and device_key_hash = v_hash;

  if v_existing_guest_id is not null then
    update public.guests set last_seen_at = now() where id = v_existing_guest_id;
    return jsonb_build_object(
      'status', 'restored',
      'guest', public._guest_profile_json(v_existing_guest_id)
    );
  end if;

  if not v_event.registration_open then
    raise exception 'registration is closed' using errcode = '55000';
  end if;

  select count(*)::integer into v_guest_count
  from public.guests
  where event_id = v_event.id;

  if v_guest_count >= least(v_event.expected_guest_count, 40) then
    raise exception 'registration capacity reached' using errcode = '55000';
  end if;

  if not p_confirm_duplicate then
    select id into v_duplicate_guest_id
    from public.guests
    where event_id = v_event.id
      and lower(first_name) = lower(v_first_name)
      and lower(last_name) = lower(v_last_name)
    limit 1;

    if v_duplicate_guest_id is not null then
      return jsonb_build_object(
        'status', 'duplicate_warning',
        'publicName', v_first_name || ' ' || upper(left(v_last_name, 1)) || '.'
      );
    end if;
  end if;

  select c.id into v_carriage_id
  from public.carriages c
  left join public.guests g on g.carriage_id = c.id and g.event_id = v_event.id
  where c.event_id = v_event.id and c.enabled
  group by c.id, c.sort_order
  order by
    count(g.id) asc,
    count(g.id) filter (where g.affiliation_type = p_affiliation_type) asc,
    random()
  limit 1;

  if v_carriage_id is null then
    raise exception 'no enabled carriages available' using errcode = '55000';
  end if;

  v_ticket_sequence := v_event.next_ticket_sequence;
  update public.events
  set next_ticket_sequence = next_ticket_sequence + 1
  where id = v_event.id;

  v_ticket_number := 'LV-' || lpad(v_ticket_sequence::text, 3, '0');

  insert into public.guests(
    event_id,
    first_name,
    last_name,
    affiliation_type,
    affiliation_detail,
    carriage_id,
    ticket_sequence,
    ticket_number
  )
  values (
    v_event.id,
    v_first_name,
    v_last_name,
    p_affiliation_type,
    v_detail,
    v_carriage_id,
    v_ticket_sequence,
    v_ticket_number
  )
  returning id into v_guest_id;

  insert into public.guest_device_bindings(event_id, guest_id, device_key_hash)
  values (v_event.id, v_guest_id, v_hash);

  return jsonb_build_object(
    'status', 'registered',
    'guest', public._guest_profile_json(v_guest_id)
  );
end;
$$;

revoke all on function public.register_guest(
  text, text, text, text, text, text, boolean
) from public;
grant execute on function public.register_guest(
  text, text, text, text, text, text, boolean
) to anon, authenticated;

-- For late repeats, global frequency remains the primary constraint. Among
-- equally valid keys, prefer a key not yet present in the arriving wagon.
create or replace function public._ensure_late_bunker_guest(
  p_event_id uuid,
  p_run_nonce uuid,
  p_guest_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contract_version integer;
  v_guest public.guests%rowtype;
  v_profile public.bunker_character_profiles%rowtype;
  v_inserted boolean := false;
begin
  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce;
  if v_contract_version is null then
    raise exception 'Bunker run contract is missing' using errcode = '55000';
  end if;

  if v_contract_version = 1 then
    perform 1
    from public.bunker_game_runs run
    where run.event_id = p_event_id and run.run_nonce = p_run_nonce
    for update;
    return public._ensure_late_bunker_guest_v1(
      p_event_id, p_run_nonce, p_guest_id
    );
  end if;
  if v_contract_version <> 2 then
    raise exception 'Bunker run contract is missing' using errcode = '55000';
  end if;

  perform 1
  from public.events event
  where event.id = p_event_id
  for key share;
  if not found then
    raise exception 'Bunker event is missing' using errcode = '55000';
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = p_event_id and run.run_nonce = p_run_nonce
  for update;
  if v_contract_version is distinct from 2 then
    raise exception 'Bunker V2 run changed during late registration'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.bunker_guest_profiles assigned
    where assigned.event_id = p_event_id
      and assigned.run_nonce = p_run_nonce
      and assigned.guest_id = p_guest_id
  ) then
    return false;
  end if;

  select guest.*
  into v_guest
  from public.guests guest
  where guest.id = p_guest_id and guest.event_id = p_event_id;
  if v_guest.id is null then
    raise exception 'registered Bunker guest required' using errcode = '42501';
  end if;

  select candidate.*
  into v_profile
  from public.bunker_character_profiles candidate
  left join lateral (
    select count(*)::integer as usage_count
    from public.bunker_guest_profiles assigned
    where assigned.run_nonce = p_run_nonce
      and assigned.character_profile_key = candidate.key
  ) usage on true
  left join lateral (
    select count(*)::integer as same_wagon_usage_count
    from public.bunker_guest_profiles assigned
    join public.guests assigned_guest on assigned_guest.id = assigned.guest_id
    where assigned.run_nonce = p_run_nonce
      and assigned.character_profile_key = candidate.key
      and assigned_guest.carriage_id = v_guest.carriage_id
  ) same_wagon on true
  where candidate.enabled
  order by usage.usage_count,
    same_wagon.same_wagon_usage_count,
    md5(p_run_nonce::text || ':late:' || p_guest_id::text || ':' || candidate.key)
  limit 1;
  if v_profile.key is null then
    raise exception 'enabled Bunker character profile required' using errcode = '55000';
  end if;

  insert into public.bunker_guest_profiles(
    event_id, run_nonce, guest_id, profession, profile, health, hobby,
    baggage, hidden_fact, ability_tags, character_profile_key,
    visible_skill, special_ability, ability_description, character_status,
    hidden_trait_revealed, ability_uses_remaining, profile_version,
    joined_late, assigned_at
  ) values (
    p_event_id, p_run_nonce, p_guest_id, v_profile.profession,
    'ПАССАЖИР СОСТАВА', v_profile.health, v_profile.visible_skill,
    'НЕТ ДАННЫХ', v_profile.hidden_trait, v_profile.tags, v_profile.key,
    v_profile.visible_skill, v_profile.special_ability,
    v_profile.ability_description, 'saved', false, v_profile.max_uses,
    v_profile.profile_version, true, now()
  )
  on conflict (run_nonce, guest_id) do nothing
  returning true into v_inserted;

  if not coalesce(v_inserted, false) then
    return false;
  end if;

  insert into public.bunker_game_events(
    event_id, run_nonce, carriage_id, guest_id, event_type, actor_type,
    schema_version, payload
  ) values (
    p_event_id, p_run_nonce, v_guest.carriage_id, p_guest_id,
    'late_guest_joined', 'system', 2,
    jsonb_build_object(
      'characterProfileKey', v_profile.key,
      'profileVersion', v_profile.profile_version,
      'characterStatus', 'saved',
      'm01Eligibility', 'late_joiner'
    )
  );

  return true;
end;
$$;

drop trigger if exists bunker_v2_ability_instance_incomplete
  on public.bunker_ability_uses;
create trigger bunker_v2_ability_instance_incomplete
before insert or update on public.bunker_ability_uses
for each row execute function public._guard_bunker_v2_ability_instance();

revoke all on function public._ensure_late_bunker_guest(uuid, uuid, uuid)
  from public, anon, authenticated;
