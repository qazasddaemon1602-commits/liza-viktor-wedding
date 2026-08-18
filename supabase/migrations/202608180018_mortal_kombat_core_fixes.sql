alter table public.mk_registrations
  drop constraint if exists mk_registrations_tournament_id_seed_key;

create unique index if not exists mk_registrations_tournament_seed_unique
  on public.mk_registrations(tournament_id, seed)
  where seed is not null;

create or replace function public.owner_promote_mk_waitlist(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.mk_registrations%rowtype;
  v_event_id uuid;
  v_active_count integer := 0;
begin
  select r into v_registration
  from public.mk_registrations r
  where r.id = p_registration_id
  for update;

  if v_registration.id is null then
    raise exception 'MK registration not found' using errcode = 'P0002';
  end if;

  select t.event_id into v_event_id
  from public.mk_tournaments t
  where t.id = v_registration.tournament_id;

  perform public._require_mk_owner(v_event_id);

  if v_registration.status <> 'waitlist' then
    raise exception 'waitlisted player required' using errcode = '55000';
  end if;

  select count(*)::integer into v_active_count
  from public.mk_registrations r
  where r.tournament_id = v_registration.tournament_id and r.status = 'active';

  if v_active_count >= 16 then
    raise exception 'active bracket is full' using errcode = '55000';
  end if;

  update public.mk_registrations
  set status = 'active', seed = null, updated_at = now()
  where id = p_registration_id;

  return jsonb_build_object('status', 'active', 'registrationId', p_registration_id);
end;
$$;

create or replace function public.owner_remove_mk_player(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.mk_registrations%rowtype;
  v_event_id uuid;
  v_tournament_state text;
begin
  select r into v_registration
  from public.mk_registrations r
  where r.id = p_registration_id
  for update;

  if v_registration.id is null then
    raise exception 'MK registration not found' using errcode = 'P0002';
  end if;

  select t.event_id, t.state
  into v_event_id, v_tournament_state
  from public.mk_tournaments t
  where t.id = v_registration.tournament_id;

  perform public._require_mk_owner(v_event_id);

  if v_tournament_state in ('active', 'complete') then
    raise exception 'use bracket correction after tournament start' using errcode = '55000';
  end if;

  update public.mk_registrations
  set status = 'withdrawn', seed = null, updated_at = now()
  where id = p_registration_id;

  return jsonb_build_object('status', 'withdrawn', 'registrationId', p_registration_id);
end;
$$;

revoke all on function public.owner_promote_mk_waitlist(uuid) from public, anon;
revoke all on function public.owner_remove_mk_player(uuid) from public, anon;
grant execute on function public.owner_promote_mk_waitlist(uuid) to authenticated;
grant execute on function public.owner_remove_mk_player(uuid) to authenticated;
