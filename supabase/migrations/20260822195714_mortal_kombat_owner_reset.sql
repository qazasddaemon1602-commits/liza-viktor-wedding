create or replace function public.owner_reset_mk_tournament(
  p_event_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
  v_registrations_removed integer := 0;
  v_matches_removed integer := 0;
begin
  perform public._require_mk_owner(p_event_id);

  if p_confirmation is distinct from 'СБРОСИТЬ ТУРНИР' then
    raise exception 'Для сброса введите: СБРОСИТЬ ТУРНИР' using errcode = '22023';
  end if;

  select t.id
  into v_tournament_id
  from public.mk_tournaments t
  where t.event_id = p_event_id
  for update;

  if v_tournament_id is null then
    return jsonb_build_object(
      'status', 'idle',
      'registrationsRemoved', 0,
      'matchesRemoved', 0
    );
  end if;

  select count(*)::integer
  into v_matches_removed
  from public.mk_matches m
  where m.tournament_id = v_tournament_id;

  select count(*)::integer
  into v_registrations_removed
  from public.mk_registrations r
  where r.tournament_id = v_tournament_id;

  delete from public.mk_matches
  where tournament_id = v_tournament_id;

  delete from public.mk_registrations
  where tournament_id = v_tournament_id;

  update public.mk_tournaments
  set state = 'registration',
      current_match_id = null,
      champion_guest_id = null,
      updated_at = now()
  where id = v_tournament_id;

  update public.event_state
  set current_module = 'idle',
      screen_mode = 'idle',
      screen_payload_id = null,
      screen_payload = null,
      screen_pinned = false,
      updated_at = now()
  where event_id = p_event_id
    and current_module = 'mortal_kombat';

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    auth.uid(),
    'mk_tournament_reset',
    jsonb_build_object(
      'registrationsRemoved', v_registrations_removed,
      'matchesRemoved', v_matches_removed
    )
  );

  return jsonb_build_object(
    'status', 'reset',
    'registrationsRemoved', v_registrations_removed,
    'matchesRemoved', v_matches_removed
  );
end;
$$;

revoke all on function public.owner_reset_mk_tournament(uuid, text) from public, anon;
grant execute on function public.owner_reset_mk_tournament(uuid, text) to authenticated;
