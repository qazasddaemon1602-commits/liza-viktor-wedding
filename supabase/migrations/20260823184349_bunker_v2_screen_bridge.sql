create or replace function public.sync_bunker_v2_screen_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
  v_title text;
begin
  if new.event_type <> 'v2_global_state_transition' then
    return new;
  end if;

  v_mode := case new.payload->>'globalGameState'
    when 'FINAL_30' then 'bunker_emergency'
    when 'BUNKER_OPEN' then 'bunker_open'
    when 'UNKNOWN_PASSENGER' then 'bunker_unknown_passenger'
    when 'MISSION_01' then 'bunker_mission'
    when 'MISSION_02' then 'bunker_mission'
    when 'MISSION_03' then 'bunker_mission'
    when 'MISSION_04' then 'bunker_mission'
    when 'MISSION_05' then 'bunker_mission'
    when 'MISSION_06' then 'bunker_mission'
    when 'CHARACTERS_READY' then 'bunker_characters_ready'
    else 'bunker'
  end;

  v_title := case new.payload->>'globalGameState'
    when 'FINAL_30' then 'ПОЕЗД ИЗМЕНИЛ МАРШРУТ'
    when 'BUNKER_OPEN' then 'БУНКЕР ОТКРЫТ'
    when 'UNKNOWN_PASSENGER' then 'НЕИЗВЕСТНЫЙ ПАССАЖИР'
    else 'БУНКЕР'
  end;

  update public.event_state
  set current_module = 'bunker',
      screen_mode = v_mode,
      screen_pinned = true,
      screen_payload = jsonb_build_object(
        'contractVersion', 2,
        'globalGameState', new.payload->>'globalGameState',
        'title', v_title,
        'runNonce', new.run_nonce
      ),
      updated_at = now()
  where event_id = new.event_id;

  return new;
end;
$$;

drop trigger if exists bunker_v2_screen_bridge_trigger
on public.bunker_game_events;

create trigger bunker_v2_screen_bridge_trigger
after insert on public.bunker_game_events
for each row execute function public.sync_bunker_v2_screen_state();
