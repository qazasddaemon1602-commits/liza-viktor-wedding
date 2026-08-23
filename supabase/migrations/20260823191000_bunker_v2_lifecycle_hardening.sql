create or replace function public.guard_bunker_v2_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_version integer;
begin
  if new.global_game_state is not distinct from old.global_game_state
    or new.run_nonce is null then
    return new;
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = new.event_id
    and run.run_nonce = new.run_nonce;

  if v_contract_version is distinct from 2 then
    return new;
  end if;

  -- A legacy STOP can leave an otherwise valid V2 run with status=idle and
  -- started_at=null.  The V2 state machine is authoritative: once it advances,
  -- make the run visible to guest/projector read models again.
  new.status := 'active';
  new.started_at := coalesce(new.started_at, clock_timestamp());
  new.phase_started_at := coalesce(new.phase_started_at, new.started_at);

  if new.global_game_state = 'FINAL_30' then
    new.final_started_at := coalesce(new.final_started_at, clock_timestamp());
    new.final_duration := coalesce(new.final_duration, 1800);
  end if;

  if new.global_game_state in ('BUNKER_OPEN', 'FINISHED') then
    new.bunker_revealed := true;
  end if;

  if new.global_game_state = 'BUNKER_OPEN' then
    new.unlocked_at := coalesce(new.unlocked_at, clock_timestamp());
  end if;

  return new;
end;
$$;

revoke all on function public.guard_bunker_v2_lifecycle()
from public, anon, authenticated;

drop trigger if exists bunker_v2_lifecycle_guard_trigger
on public.bunker_state;

create trigger bunker_v2_lifecycle_guard_trigger
before update of global_game_state on public.bunker_state
for each row execute function public.guard_bunker_v2_lifecycle();

create or replace function public.sync_bunker_v2_state_to_screen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract_version integer;
  v_mode text;
  v_title text;
begin
  if new.global_game_state is not distinct from old.global_game_state
    or new.run_nonce is null then
    return new;
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = new.event_id
    and run.run_nonce = new.run_nonce;

  if v_contract_version is distinct from 2 then
    return new;
  end if;

  v_mode := case new.global_game_state
    when 'LOBBY' then 'bunker_lobby'
    when 'CHARACTERS_READY' then 'bunker_characters_ready'
    when 'MISSION_01' then 'bunker_mission'
    when 'BREAK' then 'bunker_break'
    when 'MISSION_02' then 'bunker_mission'
    when 'MISSION_03' then 'bunker_mission'
    when 'MISSION_04' then 'bunker_mission'
    when 'MISSION_05' then 'bunker_mission'
    when 'MISSION_06' then 'bunker_mission'
    when 'UNKNOWN_PASSENGER' then 'bunker_unknown_passenger'
    when 'BREAK_BEFORE_FINAL' then 'bunker_break'
    when 'FINAL_30' then 'bunker_emergency'
    when 'BUNKER_OPEN' then 'bunker_open'
    when 'FINISHED' then 'bunker_results'
    else 'bunker'
  end;

  v_title := case new.global_game_state
    when 'LOBBY' then 'БУНКЕР · ПОДГОТОВКА'
    when 'CHARACTERS_READY' then 'ПЕРСОНАЖИ ГОТОВЫ'
    when 'MISSION_01' then 'ЛИШНИЙ ПАССАЖИР'
    when 'BREAK' then 'АРХИВНАЯ ПАУЗА · BK-17'
    when 'MISSION_02' then 'ЧЁРНЫЙ ЯЩИК'
    when 'MISSION_03' then 'АВАРИЙНЫЙ ЗАПАС'
    when 'MISSION_04' then 'МЕЖВАГОННАЯ СВЯЗЬ'
    when 'MISSION_05' then 'ОДИН ШАНС'
    when 'MISSION_06' then 'ОБЩИЙ ПРОТОКОЛ'
    when 'UNKNOWN_PASSENGER' then 'НЕИЗВЕСТНЫЙ ПАССАЖИР'
    when 'BREAK_BEFORE_FINAL' then 'ПРОВЕРКА ГОТОВНОСТИ'
    when 'FINAL_30' then 'ПОЕЗД ИЗМЕНИЛ МАРШРУТ'
    when 'BUNKER_OPEN' then 'БУНКЕР ОТКРЫТ'
    when 'FINISHED' then 'ИГРА ЗАВЕРШЕНА'
    else 'БУНКЕР'
  end;

  update public.event_state
  set current_module = 'bunker',
      screen_mode = v_mode,
      screen_pinned = true,
      screen_payload = jsonb_build_object(
        'contractVersion', 2,
        'globalGameState', new.global_game_state,
        'title', v_title,
        'runNonce', new.run_nonce,
        'finalStartedAt', new.final_started_at,
        'unlocked', new.unlocked_at is not null
      ),
      updated_at = now()
  where event_id = new.event_id;

  return new;
end;
$$;

revoke all on function public.sync_bunker_v2_state_to_screen()
from public, anon, authenticated;

drop trigger if exists bunker_v2_state_screen_sync_trigger
on public.bunker_state;

create trigger bunker_v2_state_screen_sync_trigger
after update of global_game_state on public.bunker_state
for each row execute function public.sync_bunker_v2_state_to_screen();
