-- Forward-only story alignment and operator retry correction.
-- Existing identifiers, mission mechanics, answers, timers and scoring stay intact.

create or replace function public._bunker_route_story_definition(
  p_mission_code text
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select case p_mission_code
    when 'MISSION_01' then jsonb_build_object(
      'title', 'Лишний пассажир',
      'subtitle', 'ПРОВЕРКА СОСТАВА · МАРШРУТ BK-17',
      'intro', 'Виктор ведёт поезд к BK-17. Проверьте пассажирский протокол, пока неизвестный источник ждёт состав у конечной точки.',
      'story', 'После аварийного перевода стрелки в списке появились неизвестные записи. Источник с BK-17 просит проверить состав.',
      'goal', 'Проверить состав, чтобы довести поезд Виктора до BK-17.'
    )
    when 'MISSION_02' then jsonb_build_object(
      'title', 'Чёрный ящик',
      'subtitle', 'КТО ПЕРЕВЁЛ СТРЕЛКУ · МАРШРУТ BK-17',
      'intro', 'Шесть фрагментов объяснят, кто направил поезд Виктора к BK-17 и можно ли доверять этому маршруту.',
      'story', 'Регистратор хранит команду перевода стрелки и слабый сигнал неизвестного источника, который ждёт состав у BK-17.',
      'goal', 'Восстановить запись, чтобы довести поезд Виктора до BK-17.'
    )
    when 'MISSION_03' then jsonb_build_object(
      'title', 'Аварийный запас',
      'subtitle', 'СОХРАНИТЬ СОСТАВ НА ХОДУ',
      'intro', 'Закройте не больше трёх проблем, пока Виктор удерживает поезд на служебной ветке к BK-17.',
      'story', 'Перегрузка вывела из строя системы вагонов, а запас ограничен.',
      'goal', 'Распределить запас, чтобы довести поезд Виктора до BK-17.'
    )
    when 'MISSION_04' then jsonb_build_object(
      'title', 'Межвагонная связь',
      'subtitle', 'СОБРАТЬ ПОЕЗД ЗАНОВО',
      'intro', 'Восстановите сообщение неизвестного источника с BK-17 и обменяйтесь тем, что поможет соседнему вагону.',
      'story', 'Повреждённая сеть разделила состав, но источник с BK-17 продолжает ждать и повторяет сигнал.',
      'goal', 'Восстановить связь, чтобы довести поезд Виктора до BK-17.'
    )
    when 'MISSION_05' then jsonb_build_object(
      'title', 'Один шанс',
      'subtitle', 'ПОСЛЕДНЯЯ РАЗВИЛКА К BK-17',
      'intro', 'Выберите одну ветку с учётом состояния вагона. После перевода стрелки изменить маршрут нельзя.',
      'story', 'Перед поездом Виктора последняя развилка к BK-17.',
      'goal', 'Выбрать путь, чтобы довести поезд Виктора до BK-17.'
    )
    when 'MISSION_06' then jsonb_build_object(
      'title', 'Общий протокол',
      'subtitle', 'СИГНАЛ КОНЕЧНОЙ СТАНЦИИ',
      'intro', 'Поезд Виктора у BK-17. Объедините фрагменты всех вагонов; личность ожидающего оператора пока скрыта.',
      'story', 'Неизвестный источник ждёт за воротами, но полный протокол разделён между вагонами.',
      'goal', 'Собрать общий протокол, чтобы довести поезд Виктора до BK-17.'
    )
    when 'FINAL_30' then jsonb_build_object(
      'title', 'Бункер 30:00',
      'subtitle', 'ПОСЛЕДНИЙ СИГНАЛ BK-17',
      'intro', 'Ворота закрываются. Неизвестный оператор ждёт за ними; у поезда Виктора тридцать минут.',
      'story', 'Параметры входа снова распределены между вагонами.',
      'goal', 'Собрать пакет входа и довести поезд Виктора до BK-17.'
    )
    else '{}'::jsonb
  end;
$$;
revoke all on function public._bunker_route_story_definition(text)
  from public, anon, authenticated;

update public.bunker_mission_instances instance
set definition = coalesce(instance.definition, '{}'::jsonb)
  || public._bunker_route_story_definition(instance.mission_code)
where instance.mission_code in (
  'MISSION_01', 'MISSION_02', 'MISSION_03',
  'MISSION_04', 'MISSION_05', 'MISSION_06', 'FINAL_30'
)
  and instance.definition->>'contractVersion' = '2';

create or replace function public._bunker_route_story_enrich_instance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.definition->>'contractVersion' = '2' then
    new.definition := coalesce(new.definition, '{}'::jsonb)
      || public._bunker_route_story_definition(new.mission_code);
  end if;
  return new;
end;
$$;
revoke all on function public._bunker_route_story_enrich_instance()
  from public, anon, authenticated;

drop trigger if exists zz_bunker_route_story_before_insert
  on public.bunker_mission_instances;
create trigger zz_bunker_route_story_before_insert
before insert on public.bunker_mission_instances
for each row execute function public._bunker_route_story_enrich_instance();

-- M02 projector used a historical hard-coded subtitle. Keep its response
-- shape unchanged while reading the current narrative fields from the frozen
-- run definition, as the guest read model already does.
create or replace function public.get_bunker_v2_m02_screen(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_run public.bunker_game_runs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_deadline timestamptz;
  v_title text;
  v_subtitle text;
  v_wagons jsonb;
begin
  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'not_found', 'serverNow', v_now
    );
  end if;

  select state.* into v_state
  from public.bunker_state state
  where state.event_id = v_event_id;
  if v_state.run_nonce is null then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'idle', 'serverNow', v_now
    );
  end if;

  select run.* into v_run
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_state.run_nonce;
  if v_run.contract_version <> 2 then
    return jsonb_build_object(
      'contractVersion', 2, 'status', 'legacy', 'serverNow', v_now
    );
  end if;

  select
    max(instance.deadline_at),
    max(instance.definition->>'title'),
    max(instance.definition->>'subtitle'),
    jsonb_agg(
      jsonb_build_object(
        'wagonId', instance.scope_key,
        'label', carriage.label,
        'status', case
          when instance.status = 'completed' then 'completed'
          else 'active'
        end,
        'attemptCount', (
          select count(*)
          from public.bunker_mission_decisions decision
          where decision.instance_id = instance.id
            and decision.decision_key like 'm02_answer_%'
        )
      ) order by carriage.number
    )
  into v_deadline, v_title, v_subtitle, v_wagons
  from public.bunker_mission_instances instance
  join public.carriages carriage
    on carriage.id::text = instance.scope_key
   and carriage.event_id = v_event_id
  where instance.run_nonce = v_state.run_nonce
    and instance.mission_code = 'MISSION_02';

  return jsonb_build_object(
    'contractVersion', 2,
    'status', case
      when v_state.global_game_state = 'MISSION_02' then 'active'
      else 'completed'
    end,
    'serverNow', v_now,
    'deadlineAt', coalesce(v_deadline, v_now),
    'title', coalesce(v_title, 'Чёрный ящик'),
    'subtitle', coalesce(v_subtitle, 'КТО ПЕРЕВЁЛ СТРЕЛКУ · МАРШРУТ BK-17'),
    'wagons', coalesce(v_wagons, '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_bunker_v2_m02_screen(text)
  from public, anon, authenticated;
grant execute on function public.get_bunker_v2_m02_screen(text)
  to anon, authenticated;

create or replace function public._bunker_route_story_archive_content(
  p_artifact_key text,
  p_content jsonb
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(p_content, '{}'::jsonb) || case p_artifact_key
    when 'BK-17' then jsonb_build_object(
      'title', 'Маршрут BK-17',
      'summary', 'Метка подтверждает путь поезда Виктора. Неизвестный источник ждёт состав у BK-17.'
    )
    when 'UNKNOWN-BK17' then jsonb_build_object(
      'title', 'Неизвестный оператор',
      'summary', 'Источник сигнала ждёт поезд Виктора за воротами BK-17. Личность не установлена.'
    )
    when 'SECTOR-04' then jsonb_build_object(
      'summary', 'Сектор 04 подтверждён как конечный участок маршрута поезда Виктора к BK-17.'
    )
    else '{}'::jsonb
  end;
$$;
revoke all on function public._bunker_route_story_archive_content(text, jsonb)
  from public, anon, authenticated;

update public.bunker_archive_entries archive
set content = public._bunker_route_story_archive_content(
  archive.artifact_key,
  archive.content
)
where archive.artifact_key in ('BK-17', 'UNKNOWN-BK17', 'SECTOR-04');

create or replace function public._bunker_route_story_enrich_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.content := public._bunker_route_story_archive_content(
    new.artifact_key,
    new.content
  );
  return new;
end;
$$;
revoke all on function public._bunker_route_story_enrich_archive()
  from public, anon, authenticated;

drop trigger if exists zz_bunker_route_story_archive_before_write
  on public.bunker_archive_entries;
create trigger zz_bunker_route_story_archive_before_write
before insert or update of artifact_key, content on public.bunker_archive_entries
for each row execute function public._bunker_route_story_enrich_archive();

create or replace function public._apply_bunker_route_story()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bunker_mission_instances instance
  set definition = coalesce(instance.definition, '{}'::jsonb)
    || public._bunker_route_story_definition(instance.mission_code)
  where instance.mission_code in (
    'MISSION_01', 'MISSION_02', 'MISSION_03',
    'MISSION_04', 'MISSION_05', 'MISSION_06', 'FINAL_30'
  )
    and instance.definition->>'contractVersion' = '2';

  update public.bunker_archive_entries archive
  set content = public._bunker_route_story_archive_content(
    archive.artifact_key,
    archive.content
  )
  where archive.artifact_key in ('BK-17', 'UNKNOWN-BK17', 'SECTOR-04');
end;
$$;
revoke all on function public._apply_bunker_route_story()
  from public, anon, authenticated;

select public._apply_bunker_route_story();

create or replace function public.submit_liza_bunker_operator_phrase(
  p_event_slug text,
  p_token text,
  p_stage text,
  p_option_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_access_event_id uuid;
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_now timestamptz := clock_timestamp();
  v_entered_at timestamptz;
  v_send_until timestamptz;
  v_body text;
  v_message public.bunker_operator_messages%rowtype;
begin
  if char_length(coalesce(p_token, '')) < 16
    or char_length(coalesce(p_token, '')) > 128 then
    raise exception 'invalid Liza operator access' using errcode = '42501';
  end if;

  select event.id
  into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);

  if v_event_id is null then
    raise exception 'invalid Liza operator access' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.final_five_role_access access
    where access.event_id = v_event_id
      and access.role = 'liza'
      and access.revoked_at is null
      and access.token_hash = public._final_five_token_hash(p_token)
  ) then
    raise exception 'invalid Liza operator access' using errcode = '42501';
  end if;

  select state.*
  into v_state
  from public.bunker_state state
  where state.event_id = v_event_id
  for update;

  select access.event_id
  into v_access_event_id
  from public.final_five_role_access access
  where access.event_id = v_event_id
    and access.role = 'liza'
    and access.revoked_at is null
    and access.token_hash = public._final_five_token_hash(p_token)
  for share;

  if v_access_event_id is null then
    raise exception 'invalid Liza operator access' using errcode = '42501';
  end if;

  v_now := clock_timestamp();

  if v_state.event_id is null
    or v_state.status <> 'active'
    or v_state.run_nonce is null then
    raise exception 'active Bunker V2 run required' using errcode = '55000';
  end if;

  select run.contract_version
  into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = v_event_id
    and run.run_nonce = v_state.run_nonce;

  if v_contract_version is distinct from 2 then
    raise exception 'active Bunker V2 run required' using errcode = '55000';
  end if;

  if p_stage is null
    or p_stage not in ('MISSION_02', 'MISSION_04', 'MISSION_06', 'FINAL_30')
    or p_stage is distinct from v_state.global_game_state then
    raise exception 'operator stage is not active' using errcode = '55000';
  end if;

  v_body := case p_stage
    when 'MISSION_02' then case p_option_key
      when 'm02_signal' then
        'Сигнал слабый, но я вас слышу. Продолжайте.'
      when 'm02_fragments' then
        'Не доверяйте одному фрагменту. Сверяйте всё, что нашли.'
    end
    when 'MISSION_04' then case p_option_key
      when 'm04_connection' then
        'Один вагон не дойдёт. Держите связь.'
      when 'm04_share' then
        'Передавайте не только слова. Делитесь тем, что спасёт других.'
    end
    when 'MISSION_06' then case p_option_key
      when 'm06_between' then
        'У каждого только часть маршрута. Ответ — между вами.'
      when 'm06_every_fragment' then
        'Состав почти у цели. Ни один фрагмент не лишний.'
    end
    when 'FINAL_30' then case p_option_key
      when 'final_waiting' then
        'Ворота ещё держатся. Я жду ваш сигнал.'
      when 'final_viktor' then
        'Ещё немного. Доведите поезд Виктора до конца.'
    end
  end;

  if v_body is null then
    raise exception 'invalid operator phrase option' using errcode = '22023';
  end if;

  -- Once a valid run/stage/option is established, a previously accepted
  -- message wins over wall-clock expiry. This reconciles delayed responses,
  -- reloads and a second Liza tab without reopening the choice.
  select message.*
  into v_message
  from public.bunker_operator_messages message
  where message.event_id = v_event_id
    and message.run_nonce = v_state.run_nonce::text
    and message.stage = p_stage;

  if v_message.id is not null then
    return jsonb_build_object(
      'status', 'locked',
      'serverNow', v_now,
      'message', jsonb_build_object(
        'id', v_message.id,
        'stage', v_message.stage,
        'optionKey', v_message.option_key,
        'body', v_message.body,
        'source', v_message.source,
        'publishedAt', v_message.published_at
      )
    );
  end if;

  select min(instance.started_at)
  into v_entered_at
  from public.bunker_mission_instances instance
  where instance.event_id = v_event_id
    and instance.run_nonce = v_state.run_nonce
    and instance.mission_code = p_stage
    and instance.started_at is not null;

  if v_entered_at is null then
    raise exception 'operator stage is not active' using errcode = '55000';
  end if;

  v_send_until := v_entered_at + interval '45 seconds';
  if v_now < v_entered_at or v_now >= v_send_until then
    raise exception 'operator send window is closed' using errcode = '55000';
  end if;

  insert into public.bunker_operator_messages(
    event_id, run_nonce, stage, option_key, body, source, published_at
  ) values (
    v_event_id,
    v_state.run_nonce::text,
    p_stage,
    p_option_key,
    v_body,
    'selected',
    v_now
  )
  returning * into v_message;

  return jsonb_build_object(
    'status', 'accepted',
    'serverNow', v_now,
    'message', jsonb_build_object(
      'id', v_message.id,
      'stage', v_message.stage,
      'optionKey', v_message.option_key,
      'body', v_message.body,
      'source', v_message.source,
      'publishedAt', v_message.published_at
    )
  );
end;
$$;

revoke all on function public.submit_liza_bunker_operator_phrase(
  text, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_liza_bunker_operator_phrase(
  text, text, text, text
) to anon, authenticated;
