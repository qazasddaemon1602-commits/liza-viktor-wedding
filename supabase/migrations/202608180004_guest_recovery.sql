create or replace function public.owner_issue_guest_recovery(p_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_owner uuid := auth.uid();
  v_guest public.guests%rowtype;
  v_event public.events%rowtype;
  v_raw text;
  v_code text;
  v_hash text;
  v_expires_at timestamptz := now() + interval '15 minutes';
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select g.* into v_guest
  from public.guests g
  where g.id = p_guest_id;

  if v_guest.id is null then
    raise exception 'guest not found' using errcode = 'P0002';
  end if;

  select e.* into v_event
  from public.events e
  where e.id = v_guest.event_id
    and e.owner_user_id = v_owner;

  if v_event.id is null then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  update public.guest_recovery_codes
  set consumed_at = coalesce(consumed_at, now())
  where event_id = v_event.id
    and guest_id = v_guest.id
    and consumed_at is null;

  v_raw := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
  v_code := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);
  v_hash := encode(digest(replace(v_code, '-', ''), 'sha256'), 'hex');

  insert into public.guest_recovery_codes (
    event_id,
    guest_id,
    token_hash,
    expires_at
  ) values (
    v_event.id,
    v_guest.id,
    v_hash,
    v_expires_at
  );

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    v_event.id,
    v_owner,
    'guest_recovery_issued',
    jsonb_build_object(
      'guestId', v_guest.id,
      'expiresAt', v_expires_at
    )
  );

  return jsonb_build_object(
    'status', 'issued',
    'guestId', v_guest.id,
    'code', v_code,
    'expiresAt', v_expires_at
  );
end;
$$;

create or replace function public.recover_guest(
  p_event_slug text,
  p_recovery_code text,
  p_device_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.events%rowtype;
  v_recovery public.guest_recovery_codes%rowtype;
  v_guest public.guests%rowtype;
  v_code_normalized text;
  v_code_hash text;
  v_device_hash text;
  v_bound_guest uuid;
begin
  if coalesce(public._normalize_spaces(p_event_slug), '') = '' then
    raise exception 'event slug is required' using errcode = '22023';
  end if;

  if coalesce(btrim(p_recovery_code), '') = '' then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;

  if coalesce(btrim(p_device_key), '') = '' then
    raise exception 'device key is required' using errcode = '22023';
  end if;

  select e.* into v_event
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug);

  if v_event.id is null then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;

  v_code_normalized := upper(regexp_replace(p_recovery_code, '[^A-Za-z0-9]', '', 'g'));
  if length(v_code_normalized) <> 8 then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;
  v_code_hash := encode(digest(v_code_normalized, 'sha256'), 'hex');
  v_device_hash := public._device_hash(p_device_key);

  select r.* into v_recovery
  from public.guest_recovery_codes r
  where r.event_id = v_event.id
    and r.token_hash = v_code_hash
    and r.consumed_at is null
    and r.expires_at > now()
  for update;

  if v_recovery.id is null then
    return jsonb_build_object('status', 'invalid_or_expired');
  end if;

  select b.guest_id into v_bound_guest
  from public.guest_device_bindings b
  where b.event_id = v_event.id
    and b.device_key_hash = v_device_hash;

  if v_bound_guest is not null and v_bound_guest <> v_recovery.guest_id then
    return jsonb_build_object('status', 'device_already_bound');
  end if;

  delete from public.guest_device_bindings
  where event_id = v_event.id
    and guest_id = v_recovery.guest_id;

  insert into public.guest_device_bindings(event_id, guest_id, device_key_hash)
  values (v_event.id, v_recovery.guest_id, v_device_hash)
  on conflict (event_id, device_key_hash)
  do update set guest_id = excluded.guest_id;

  update public.guest_recovery_codes
  set consumed_at = now()
  where id = v_recovery.id;

  update public.guests
  set last_seen_at = now()
  where id = v_recovery.guest_id
  returning * into v_guest;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    v_event.id,
    v_event.owner_user_id,
    'guest_recovered',
    jsonb_build_object('guestId', v_guest.id)
  );

  return jsonb_build_object(
    'status', 'recovered',
    'guest', public._guest_profile_json(v_guest.id)
  );
end;
$$;

revoke all on function public.owner_issue_guest_recovery(uuid) from public;
grant execute on function public.owner_issue_guest_recovery(uuid) to authenticated;

revoke all on function public.recover_guest(text, text, text) from public;
grant execute on function public.recover_guest(text, text, text) to anon, authenticated;
