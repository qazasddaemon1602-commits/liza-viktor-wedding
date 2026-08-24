alter function public.get_bunker_screen_state(text)
  rename to _get_bunker_screen_state_before_frozen_wagons;
revoke all on function public._get_bunker_screen_state_before_frozen_wagons(text)
  from public, anon, authenticated;

create or replace function public.get_bunker_screen_state(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_plan jsonb;
  v_teams jsonb := '[]'::jsonb;
begin
  v_result := public._get_bunker_screen_state_before_frozen_wagons(p_event_slug);
  if v_result->>'status' <> 'active' then
    return v_result;
  end if;

  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  select state.* into v_state
  from public.bunker_state state
  where state.event_id = v_event_id;
  select run.plan into v_plan
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_state.run_nonce;

  select coalesce(jsonb_agg(team.value order by team.ordinal), '[]'::jsonb)
  into v_teams
  from jsonb_array_elements(coalesce(v_result->'teams', '[]'::jsonb))
    with ordinality team(value, ordinal)
  where coalesce(jsonb_typeof(v_plan->'activeWagonIds'), '') <> 'array'
    or (team.value->>'carriageNumber')::integer in (
      select carriage.number
      from public.carriages carriage
      join jsonb_array_elements_text(v_plan->'activeWagonIds') planned(id)
        on carriage.id = planned.id::uuid
      where carriage.event_id = v_event_id
    );

  return v_result || jsonb_build_object('teams', v_teams);
end;
$$;

revoke all on function public.get_bunker_screen_state(text)
  from public, anon, authenticated;
grant execute on function public.get_bunker_screen_state(text)
  to anon, authenticated;
