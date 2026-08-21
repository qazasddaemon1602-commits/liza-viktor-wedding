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
  for update;

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
