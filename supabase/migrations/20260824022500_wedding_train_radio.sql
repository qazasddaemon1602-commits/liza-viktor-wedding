create or replace function public.owner_send_train_radio(
  p_event_slug text,
  p_preset text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_event_id uuid;
  v_label text;
  v_message text;
  v_event_row_id uuid;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug)
    and e.owner_user_id = v_owner;

  if v_event_id is null then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  if p_preset not in ('departure','toast','quiet_carriage','late_passenger','kiss','dance','quiz','arena','bunker','final') then
    raise exception 'unknown train radio preset' using errcode = '22023';
  end if;

  select
    case p_preset
      when 'departure' then 'ОТПРАВЛЕНИЕ'
      when 'toast' then 'СЛЕДУЮЩАЯ СТАНЦИЯ'
      when 'quiet_carriage' then 'ДИСПЕТЧЕРСКАЯ'
      when 'late_passenger' then 'СЛУЖЕБНОЕ СООБЩЕНИЕ'
      when 'kiss' then 'ТЕХНИЧЕСКАЯ ОСТАНОВКА'
      when 'dance' then 'ТАНЦПОЛ'
      when 'quiz' then 'ДИСПЕТЧЕРСКАЯ КВИЗА'
      when 'arena' then 'АРЕНА'
      when 'bunker' then 'НЕОПОЗНАННЫЙ СИГНАЛ'
      when 'final' then 'КОНЕЧНАЯ'
    end,
    case p_preset
      when 'departure' then 'Внимание пассажирам. Поезд Лизы и Виктора отправляется. Просьба занять места и поднять настроение.'
      when 'toast' then 'Следующая станция — хороший повод поднять бокалы. Стоянка не ограничена.'
      when 'quiet_carriage' then 'Диспетчерская сообщает: один из вагонов подозрительно тихий. Проверяем наличие танцующих.'
      when 'late_passenger' then 'Опоздавшим пассажирам разрешено догонять состав исключительно с хорошим настроением.'
      when 'kiss' then 'Техническая остановка. Причина — недостаточное количество поцелуев молодожёнов.'
      when 'dance' then 'По внутренней связи: танцевальная платформа свободна. Пассажирам рекомендовано немедленно это исправить.'
      when 'quiz' then 'Диспетчерская не подтверждает правильность ваших ответов. Но уверенность звучит убедительно.'
      when 'arena' then 'На арене повышенная активность. Крики поддержки приветствуются. Берегите достоинство проигравших.'
      when 'bunker' then 'Обнаружен неопознанный сигнал. Сохраняйте связь между вагонами. Паниковать красиво, но бесполезно.'
      when 'final' then 'Состав приближается к конечной. Сохраните этот вечер в памяти и не забудьте обнять тех, кто рядом.'
    end
  into v_label, v_message;

  insert into public.screen_events(
    event_id,
    event_slug,
    kind,
    payload,
    public_visible,
    expires_at
  )
  values (
    v_event_id,
    public._normalize_spaces(p_event_slug),
    'radio_transmission',
    jsonb_build_object(
      'preset', p_preset,
      'label', v_label,
      'message', v_message,
      'durationMs', 12000
    ),
    true,
    now() + interval '14 seconds'
  )
  returning id into v_event_row_id;

  return jsonb_build_object(
    'status', 'sent',
    'eventId', v_event_row_id,
    'preset', p_preset,
    'durationMs', 12000
  );
end;
$$;

revoke all on function public.owner_send_train_radio(text, text) from public, anon;
grant execute on function public.owner_send_train_radio(text, text) to authenticated;
