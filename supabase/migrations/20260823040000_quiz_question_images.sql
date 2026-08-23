with seed(sort_order, question_text, image_path) as (
  values
    (1, 'Кто дольше собирается?', '/images/quiz/q01.webp'),
    (2, 'Кто первым мирится после ссоры?', '/images/quiz/q02.webp'),
    (3, 'Кто чаще говорит «Я же говорил»?', '/images/quiz/q03.webp'),
    (4, 'Кто скорее заведёт ещё одного питомца?', '/images/quiz/q04.webp'),
    (5, 'Кто переживёт зомби-апокалипсис?', '/images/quiz/q05.webp'),
    (6, 'Кто чаще делает спонтанные покупки?', '/images/quiz/q06.webp'),
    (7, 'Кто в доме главный?', '/images/quiz/q07.webp'),
    (8, 'Кто быстрее уснёт во время фильма?', '/images/quiz/q08.webp'),
    (9, 'Кто лучше готовит?', '/images/quiz/q09.webp'),
    (10, 'Кто скорее предложит заказать доставку?', '/images/quiz/q10.webp'),
    (11, 'Кто транжира?', '/images/quiz/q11.webp'),
    (12, 'Кто кого больше избаловал?', '/images/quiz/q12.webp'),
    (13, 'Кто чаще теряет телефон?', '/images/quiz/q13.webp'),
    (14, 'Кто может пойти за хлебом и вернуться со всем, кроме хлеба?', '/images/quiz/q14.webp'),
    (15, 'Кто прочитает инструкцию до сборки мебели?', '/images/quiz/q15.webp'),
    (16, 'Кто первым замечает бардак?', '/images/quiz/q16.webp'),
    (17, 'Кто быстрее заснёт после «я вообще не хочу спать»?', '/images/quiz/q17.webp'),
    (18, 'Кто сильнее бесится, когда второй опаздывает?', '/images/quiz/q18.webp'),
    (19, 'Кто чаще проверяет, закрыта ли дверь?', '/images/quiz/q19.webp'),
    (20, 'Кто выбирает маршрут в навигаторе?', '/images/quiz/q20.webp'),
    (21, 'Кто больше фотографирует в отпуске?', '/images/quiz/q21.webp'),
    (22, 'Кто проживёт неделю без телефона?', '/images/quiz/q22.webp'),
    (23, 'Кто полезет чинить дома сам?', '/images/quiz/q23.webp'),
    (24, 'Кто лучше пройдёт детектор лжи?', '/images/quiz/q24.webp'),
    (25, 'Кто первым смеётся в неподходящий момент?', '/images/quiz/q25.webp'),
    (26, 'Кто более азартный?', '/images/quiz/q26.webp'),
    (27, 'Кто добровольно берёт микрофон в караоке?', '/images/quiz/q27.webp'),
    (28, 'Кто первым говорит «пора домой»?', '/images/quiz/q28.webp'),
    (29, 'Кто лучше помнит даты?', '/images/quiz/q29.webp'),
    (30, 'Кто смотрит сериал без второго и делает вид, что нет?', '/images/quiz/q30.webp')
)
update public.questions q
set image_path = seed.image_path,
    updated_at = now()
from seed
where q.question_type = 'standard'
  and q.sort_order = seed.sort_order
  and q.text = seed.question_text
  and q.image_path is distinct from seed.image_path;

create or replace function public.owner_seed_default_quiz_questions(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_inserted_count integer := 0;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.owner_user_id = v_owner
  ) then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.questions q
    where q.event_id = p_event_id
  ) then
    insert into public.quiz_state(event_id, phase, updated_at)
    values (p_event_id, 'idle', now())
    on conflict (event_id) do nothing;

    return jsonb_build_object(
      'status', 'existing',
      'insertedCount', 0
    );
  end if;

  insert into public.questions(
    event_id,
    text,
    question_type,
    sort_order,
    enabled,
    image_path
  )
  select
    p_event_id,
    defaults.question_text,
    'standard',
    defaults.sort_order,
    true,
    defaults.image_path
  from (
    values
      ('Кто дольше собирается?', 1, '/images/quiz/q01.webp'),
      ('Кто первым мирится после ссоры?', 2, '/images/quiz/q02.webp'),
      ('Кто чаще говорит «Я же говорил»?', 3, '/images/quiz/q03.webp'),
      ('Кто скорее заведёт ещё одного питомца?', 4, '/images/quiz/q04.webp'),
      ('Кто переживёт зомби-апокалипсис?', 5, '/images/quiz/q05.webp'),
      ('Кто чаще делает спонтанные покупки?', 6, '/images/quiz/q06.webp'),
      ('Кто в доме главный?', 7, '/images/quiz/q07.webp'),
      ('Кто быстрее уснёт во время фильма?', 8, '/images/quiz/q08.webp'),
      ('Кто лучше готовит?', 9, '/images/quiz/q09.webp'),
      ('Кто скорее предложит заказать доставку?', 10, '/images/quiz/q10.webp'),
      ('Кто транжира?', 11, '/images/quiz/q11.webp'),
      ('Кто кого больше избаловал?', 12, '/images/quiz/q12.webp'),
      ('Кто чаще теряет телефон?', 13, '/images/quiz/q13.webp'),
      ('Кто может пойти за хлебом и вернуться со всем, кроме хлеба?', 14, '/images/quiz/q14.webp'),
      ('Кто прочитает инструкцию до сборки мебели?', 15, '/images/quiz/q15.webp'),
      ('Кто первым замечает бардак?', 16, '/images/quiz/q16.webp'),
      ('Кто быстрее заснёт после «я вообще не хочу спать»?', 17, '/images/quiz/q17.webp'),
      ('Кто сильнее бесится, когда второй опаздывает?', 18, '/images/quiz/q18.webp'),
      ('Кто чаще проверяет, закрыта ли дверь?', 19, '/images/quiz/q19.webp'),
      ('Кто выбирает маршрут в навигаторе?', 20, '/images/quiz/q20.webp'),
      ('Кто больше фотографирует в отпуске?', 21, '/images/quiz/q21.webp'),
      ('Кто проживёт неделю без телефона?', 22, '/images/quiz/q22.webp'),
      ('Кто полезет чинить дома сам?', 23, '/images/quiz/q23.webp'),
      ('Кто лучше пройдёт детектор лжи?', 24, '/images/quiz/q24.webp'),
      ('Кто первым смеётся в неподходящий момент?', 25, '/images/quiz/q25.webp'),
      ('Кто более азартный?', 26, '/images/quiz/q26.webp'),
      ('Кто добровольно берёт микрофон в караоке?', 27, '/images/quiz/q27.webp'),
      ('Кто первым говорит «пора домой»?', 28, '/images/quiz/q28.webp'),
      ('Кто лучше помнит даты?', 29, '/images/quiz/q29.webp'),
      ('Кто смотрит сериал без второго и делает вид, что нет?', 30, '/images/quiz/q30.webp')
  ) as defaults(question_text, sort_order, image_path)
  order by defaults.sort_order;

  get diagnostics v_inserted_count = row_count;

  insert into public.quiz_state(event_id, phase, updated_at)
  values (p_event_id, 'idle', now())
  on conflict (event_id) do nothing;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'quiz_default_questions_seeded',
    jsonb_build_object('insertedCount', v_inserted_count)
  );

  return jsonb_build_object(
    'status', 'seeded',
    'insertedCount', v_inserted_count
  );
end;
$$;

revoke all on function public.owner_seed_default_quiz_questions(uuid) from public, anon;
grant execute on function public.owner_seed_default_quiz_questions(uuid) to authenticated;
