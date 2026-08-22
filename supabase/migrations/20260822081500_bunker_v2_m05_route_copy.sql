-- Forward-only copy correction after the canonical M05 outcome model.
-- Do not reveal the exact five-minute value before the decision, but make the
-- safe detour's final-time cost unambiguous.

create or replace function public._bunker_v2_m05_definition()
returns jsonb
language sql
immutable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'title','Один шанс',
    'intro','У вас 90 секунд. Обсудите риск и выберите маршрут вагона. Решение изменит состояние поезда и финальное время.',
    'routes',jsonb_build_array(
      jsonb_build_object(
        'key','A',
        'title','Технический тоннель',
        'description','Короче и быстрее, но путь нестабилен.',
        'risk','Повышенный риск повреждений и скачка питания.'
      ),
      jsonb_build_object(
        'key','B',
        'title','Обходной путь',
        'description','Дольше, зато состояние пути лучше.',
        'risk','Меньше риска, но обход отнимет время в финале.'
      )
    )
  );
$$;
revoke all on function public._bunker_v2_m05_definition()
  from public,anon,authenticated;

update public.bunker_mission_instances instance
set definition = coalesce(instance.definition,'{}'::jsonb)
  || public._bunker_v2_m05_definition()
where instance.mission_code='MISSION_05'
  and instance.definition->>'contractVersion'='2';
