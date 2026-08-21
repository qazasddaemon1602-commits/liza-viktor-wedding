-- M02 «Чёрный ящик». Forward-only: published M01 migrations stay immutable.

alter function public.submit_bunker_command(text,text,uuid,text,jsonb)
  rename to _submit_bunker_command_m01;
revoke all on function public._submit_bunker_command_m01(text,text,uuid,text,jsonb)
  from public, anon, authenticated;

create function public._bunker_m02_correct_answers()
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_array('Вагон №4','Открытие технического шлюза','05');
$$;
revoke all on function public._bunker_m02_correct_answers() from public, anon, authenticated;

create function public._bunker_m02_public_definition()
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title','Чёрный ящик',
    'subtitle','ВОССТАНОВЛЕНИЕ ДАННЫХ ПОСЛЕ АВАРИИ',
    'intro','Чёрный ящик частично повреждён. Восстановлено шесть фрагментов записи. Только часть данных подлинна. Сопоставьте время, технические события и маршрут.',
    'evidence',jsonb_build_array(
      jsonb_build_object('key','evidence_01','label','Фрагмент 01','body','18:42:11 · Автодиагностика: потеря связи с датчиком двери вагона №4.'),
      jsonb_build_object('key','evidence_02','label','Фрагмент 02','body','18:42:16 · Питание состава стабильно. Аварийного отключения освещения не зарегистрировано.'),
      jsonb_build_object('key','evidence_03','label','Фрагмент 03','body','18:42:19 · Маршрутный контроллер: изменение основного маршрута в этот момент не подтверждено.'),
      jsonb_build_object('key','evidence_04','label','Фрагмент 04','body','18:42:23 · Служебная линия: зарегистрирован запрос к техническому шлюзу.'),
      jsonb_build_object('key','evidence_05','label','Фрагмент 05','body','18:42:25 · Источник аварийного сигнала: вагон №4. Технический шлюз открыт вручную.'),
      jsonb_build_object('key','evidence_06','label','Фрагмент 06','body','18:42:31 · Запись повреждена: контрольная сумма фрагмента не совпадает с архивной.')
    ),
    'questions',jsonb_build_array(
      jsonb_build_object('key','wagon','prompt','Из какого вагона пришёл аварийный сигнал?','options',jsonb_build_array('Вагон №2','Вагон №3','Вагон №4')),
      jsonb_build_object('key','event','prompt','Какое действие произошло непосредственно перед сбоем?','options',jsonb_build_array('Открытие технического шлюза','Отключение освещения','Запуск резервного питания')),
      jsonb_build_object('key','evidence','prompt','Какой номер фрагмента подтверждает вывод?','options',jsonb_build_array('03','05','06'))
    )
  );
$$;
revoke all on function public._bunker_m02_public_definition() from public, anon, authenticated;

-- Enrich already prepared V2 runs without changing their frozen membership/ids.
update public.bunker_mission_instances instance
set definition = instance.definition || public._bunker_m02_public_definition()
where instance.mission_code='MISSION_02' and instance.definition->>'contractVersion'='2';

create function public._bunker_m02_enrich_instance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.mission_code='MISSION_02' and new.definition->>'contractVersion'='2' then
    new.definition := new.definition || public._bunker_m02_public_definition();
  end if;
  return new;
end;
$$;
revoke all on function public._bunker_m02_enrich_instance() from public, anon, authenticated;
create trigger bunker_m02_enrich_instance_before_insert
before insert on public.bunker_mission_instances
for each row execute function public._bunker_m02_enrich_instance();

create function public._submit_bunker_command_m02(
  p_event_slug text,p_device_key text,p_command_id uuid,p_command_type text,p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid; v_guest public.guests%rowtype; v_state public.bunker_state%rowtype;
  v_run public.bunker_game_runs%rowtype; v_instance public.bunker_mission_instances%rowtype;
  v_profile public.bunker_guest_profiles%rowtype; v_existing public.bunker_command_receipts%rowtype;
  v_hash text; v_result jsonb; v_answers jsonb; v_expected jsonb; v_attempt integer; v_success boolean;
  v_entry_id uuid; v_effect jsonb; v_now timestamptz:=clock_timestamp();
begin
  if p_command_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'invalid M02 command' using errcode='22023';
  end if;
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);
  if v_event_id is null then raise exception 'Bunker event not found' using errcode='P0002'; end if;
  select g.* into v_guest from public.guests g where g.event_id=v_event_id and g.id=public._bunker_guest_id(p_event_slug,p_device_key);
  if v_guest.id is null then raise exception 'registered Bunker guest required' using errcode='42501'; end if;
  select s.* into v_state from public.bunker_state s where s.event_id=v_event_id for update;
  if v_state.run_nonce is null then raise exception 'active Bunker V2 run required' using errcode='55000'; end if;
  select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;
  if v_run.contract_version is distinct from 2 then raise exception 'active Bunker V2 run required' using errcode='55000'; end if;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('commandType',p_command_type,'payload',p_payload)::text,'UTF8'),'sha256'),'hex');
  select r.* into v_existing from public.bunker_command_receipts r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce and r.actor_kind='guest' and r.actor_id=v_guest.id and r.command_id=p_command_id;
  if v_existing.id is not null then
    if v_existing.request_hash<>v_hash then raise exception 'idempotency_conflict' using errcode='55000'; end if;
    return v_existing.result;
  end if;
  if v_state.global_game_state<>'MISSION_02' then raise exception 'M02 is not the current Bunker V2 stage' using errcode='55000'; end if;
  begin
    select i.* into v_instance from public.bunker_mission_instances i
    where i.event_id=v_event_id and i.run_nonce=v_state.run_nonce and i.id=(p_payload->>'instanceId')::uuid
    for update;
  exception when invalid_text_representation then raise exception 'invalid M02 instance id' using errcode='22023'; end;
  if v_instance.id is null or v_instance.mission_code<>'MISSION_02' then raise exception 'M02 instance not found' using errcode='P0002'; end if;
  if v_instance.scope_kind<>'wagon' or v_instance.scope_key<>v_guest.carriage_id::text then raise exception 'M02 instance does not belong to the guest wagon' using errcode='42501'; end if;
  if v_instance.status='completed' then raise exception 'M02 is already completed' using errcode='55000'; end if;
  select p.* into v_profile from public.bunker_guest_profiles p where p.run_nonce=v_state.run_nonce and p.guest_id=v_guest.id for update;

  if p_command_type='use_ability' then
    if (select count(*) from jsonb_object_keys(p_payload))<>2 or not (p_payload ?& array['instanceId','problemKey']) then raise exception 'invalid M02 ability payload' using errcode='22023'; end if;
    if v_profile.special_ability not in ('system_access','terminal_hack') or p_payload->>'problemKey'<>v_profile.special_ability or v_profile.ability_uses_remaining<1 then raise exception 'M02 ability is unavailable' using errcode='42501'; end if;
    if exists(select 1 from public.bunker_ability_uses u where u.instance_id=v_instance.id and u.guest_id=v_guest.id and u.status='committed') then raise exception 'M02 ability is already used' using errcode='55000'; end if;
    v_effect:=case v_profile.special_ability
      when 'system_access' then jsonb_build_object('hint','Служебный журнал подтверждает: важен порядок событий непосредственно перед аварийным сигналом.')
      else jsonb_build_object('hint','Проверка контрольных сумм показывает: фрагмент 05 относится к подлинной цепочке записи.') end;
    insert into public.bunker_ability_uses(event_id,run_nonce,instance_id,guest_id,ability_key,problem_key,status,command_id,effect)
    values(v_event_id,v_state.run_nonce,v_instance.id,v_guest.id,v_profile.special_ability,v_profile.special_ability,'committed',p_command_id,v_effect);
    update public.bunker_guest_profiles set ability_uses_remaining=ability_uses_remaining-1, ability_used_at=v_now where run_nonce=v_state.run_nonce and guest_id=v_guest.id;
  elsif p_command_type='submit_answer' then
    if (select count(*) from jsonb_object_keys(p_payload))<>2 or not (p_payload ?& array['instanceId','answers']) or jsonb_typeof(p_payload->'answers')<>'array' or jsonb_array_length(p_payload->'answers')<>3 then raise exception 'M02 requires exactly three answers' using errcode='22023'; end if;
    v_attempt:=(select count(*) from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key like 'm02_answer_%')+1;
    if v_attempt>2 then raise exception 'M02 attempt limit reached' using errcode='55000'; end if;
    v_answers:=p_payload->'answers'; v_expected:=public._bunker_m02_correct_answers();
    v_success:=lower(btrim(v_answers->>0))=lower(btrim(v_expected->>0)) and lower(btrim(v_answers->>1))=lower(btrim(v_expected->>1)) and lower(btrim(v_answers->>2))=lower(btrim(v_expected->>2));
    insert into public.bunker_mission_decisions(event_id,run_nonce,instance_id,decision_key,actor_kind,actor_id,actor_scope_key,status,instance_version,command_id,payload,outcome,confirmed_at)
    values(v_event_id,v_state.run_nonce,v_instance.id,'m02_answer_'||v_attempt,'wagon',v_guest.id,v_instance.scope_key,'confirmed',v_instance.instance_version,p_command_id,jsonb_build_object('answers',v_answers),jsonb_build_object('success',v_success,'attempt',v_attempt),v_now);
    if v_success then
      select a.id into v_entry_id from public.bunker_archive_entries a where a.run_nonce=v_state.run_nonce and a.carriage_id=v_guest.carriage_id and a.artifact_key='BK-17' limit 1;
      if v_entry_id is null then
        insert into public.bunker_archive_entries(event_id,run_nonce,carriage_id,artifact_key,content_type,content,decryption_status,decoded_at)
        values(v_event_id,v_state.run_nonce,v_guest.carriage_id,'BK-17','document',jsonb_build_object('title','BK-17','summary','Идентификатор связан с неизвестным пассажиром и сектором 04.'),'decoded',v_now) returning id into v_entry_id;
      end if;
      insert into public.bunker_archive_entitlements(event_id,run_nonce,archive_entry_id,carriage_id,owner_scope_kind,owner_scope_key,status)
      select v_event_id,v_state.run_nonce,v_entry_id,v_guest.carriage_id,'wagon',v_guest.carriage_id::text,'active'
      where not exists(select 1 from public.bunker_archive_entitlements e where e.run_nonce=v_state.run_nonce and e.archive_entry_id=v_entry_id and e.owner_scope_kind='wagon' and e.owner_scope_key=v_guest.carriage_id::text);
    end if;
    if v_success or v_attempt=2 then
      update public.bunker_mission_instances set status='completed',completed_at=v_now,outcome=jsonb_build_object('status',case when v_success then 'success' else 'black_box_incomplete' end,'attemptCount',v_attempt,'archiveUnlocked',case when v_success then 'BK-17' else null end) where id=v_instance.id;
      update public.bunker_mission_members set member_status='completed',updated_at=v_now where instance_id=v_instance.id;
    end if;
  else
    raise exception 'unsupported M02 command type' using errcode='22023';
  end if;

  v_result:=jsonb_build_object('contractVersion',2,'status','accepted','commandId',p_command_id,'commandType',p_command_type);
  insert into public.bunker_command_receipts(event_id,run_nonce,actor_kind,actor_id,command_id,command_type,request_hash,result)
  values(v_event_id,v_state.run_nonce,'guest',v_guest.id,p_command_id,p_command_type,v_hash,v_result);
  insert into public.bunker_game_events(event_id,run_nonce,carriage_id,guest_id,event_type,actor_type,actor_id,command_id,correlation_id,instance_id,schema_version,payload)
  values(v_event_id,v_state.run_nonce,v_guest.carriage_id,v_guest.id,case when p_command_type='submit_answer' then 'decision_confirmed' else 'ability_used' end,'guest',v_guest.id,p_command_id,p_command_id,v_instance.id,2,jsonb_build_object('missionCode','MISSION_02','commandType',p_command_type));
  return v_result;
end;
$$;
revoke all on function public._submit_bunker_command_m02(text,text,uuid,text,jsonb) from public,anon,authenticated;

create function public.submit_bunker_command(p_event_slug text,p_device_key text,p_command_id uuid,p_command_type text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_event_id uuid; v_state public.bunker_state%rowtype; v_instance_id uuid;
begin
  -- Preserve the established M01 lock order before handing off to its immutable implementation.
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);
  select state.* into v_state from public.bunker_state state where state.event_id=v_event_id for update;
  if p_command_type in ('submit_answer','use_ability') then return public._submit_bunker_command_m02(p_event_slug,p_device_key,p_command_id,p_command_type,p_payload); end if;
  if p_command_type='mission_confirm' then
    begin v_instance_id:=(p_payload->>'instanceId')::uuid; exception when others then v_instance_id:=null; end;
    perform 1 from public.bunker_mission_instances instance where instance.id=v_instance_id for update;
    perform 1 from public.bunker_mission_members member where member.instance_id=v_instance_id order by member.id for update;
  end if;
  return public._submit_bunker_command_m01(p_event_slug,p_device_key,p_command_id,p_command_type,p_payload);
end;
$$;
revoke all on function public.submit_bunker_command(text,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_bunker_command(text,text,uuid,text,jsonb) to anon,authenticated;

create function public.get_guest_bunker_v2_m02(p_event_slug text,p_device_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event_id uuid; v_guest public.guests%rowtype; v_state public.bunker_state%rowtype; v_run public.bunker_game_runs%rowtype; v_instance public.bunker_mission_instances%rowtype; v_wagon public.carriages%rowtype; v_attempt integer; v_answers jsonb:='["","",""]'::jsonb; v_ability jsonb:=null; v_outcome text; v_archive text; v_now timestamptz:=clock_timestamp();
begin
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug); if v_event_id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;
  select g.* into v_guest from public.guests g where g.event_id=v_event_id and g.id=public._bunker_guest_id(p_event_slug,p_device_key); if v_guest.id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;
  select s.* into v_state from public.bunker_state s where s.event_id=v_event_id; if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce; if v_run.contract_version<>2 then return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now); end if;
  select i.* into v_instance from public.bunker_mission_instances i where i.run_nonce=v_state.run_nonce and i.mission_code='MISSION_02' and i.scope_key=v_guest.carriage_id::text limit 1;
  if v_instance.id is null or v_state.global_game_state not in ('MISSION_02','MISSION_03','MISSION_04','MISSION_05','MISSION_06','UNKNOWN_PASSENGER','BREAK_BEFORE_FINAL','FINAL_30','BUNKER_OPEN','FINISHED') then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select c.* into v_wagon from public.carriages c where c.id=v_guest.carriage_id;
  v_attempt:=(select count(*) from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key like 'm02_answer_%');
  select d.payload->'answers' into v_answers from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key like 'm02_answer_%' order by d.confirmed_at desc limit 1; v_answers:=coalesce(v_answers,'["","",""]'::jsonb);
  if (select p.special_ability from public.bunker_guest_profiles p where p.run_nonce=v_state.run_nonce and p.guest_id=v_guest.id) in ('system_access','terminal_hack') then
    select jsonb_build_object('available',not exists(select 1 from public.bunker_ability_uses u where u.instance_id=v_instance.id and u.guest_id=v_guest.id and u.status='committed'),'key',p.special_ability,'label',case p.special_ability when 'system_access' then 'Служебный доступ' else 'Работа со служебным терминалом' end,'hint',coalesce((select u.effect->>'hint' from public.bunker_ability_uses u where u.instance_id=v_instance.id and u.guest_id=v_guest.id and u.status='committed' limit 1),'Можно один раз получить дополнительную техническую подсказку.')) into v_ability from public.bunker_guest_profiles p where p.run_nonce=v_state.run_nonce and p.guest_id=v_guest.id;
  end if;
  v_outcome:=v_instance.outcome->>'status'; v_archive:=v_instance.outcome->>'archiveUnlocked';
  return jsonb_strip_nulls(jsonb_build_object('contractVersion',2,'status',case when v_instance.status='completed' then 'completed' else 'active' end,'serverNow',v_now,'instanceId',v_instance.id,'instanceVersion',v_instance.instance_version,'deadlineAt',coalesce(v_instance.deadline_at,v_now),'title',v_instance.definition->>'title','subtitle',v_instance.definition->>'subtitle','intro',v_instance.definition->>'intro','wagon',jsonb_build_object('number',v_wagon.number,'label',v_wagon.label),'evidence',v_instance.definition->'evidence','questions',v_instance.definition->'questions','attemptCount',v_attempt,'attemptsRemaining',greatest(0,2-v_attempt),'selectedAnswers',v_answers,'ability',v_ability,'outcome',v_outcome,'archiveUnlocked',v_archive));
end;$$;
revoke all on function public.get_guest_bunker_v2_m02(text,text) from public,anon,authenticated; grant execute on function public.get_guest_bunker_v2_m02(text,text) to anon,authenticated;

create function public.get_bunker_v2_m02_screen(p_event_slug text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_event_id uuid; v_state public.bunker_state%rowtype; v_run public.bunker_game_runs%rowtype; v_now timestamptz:=clock_timestamp(); v_deadline timestamptz; v_wagons jsonb;
begin
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug); if v_event_id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;
  select s.* into v_state from public.bunker_state s where s.event_id=v_event_id; if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce; if v_run.contract_version<>2 then return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now); end if;
  select max(i.deadline_at),jsonb_agg(jsonb_build_object('wagonId',i.scope_key,'label',c.label,'status',case when i.status='completed' then 'completed' else 'active' end,'attemptCount',(select count(*) from public.bunker_mission_decisions d where d.instance_id=i.id and d.decision_key like 'm02_answer_%')) order by c.number) into v_deadline,v_wagons from public.bunker_mission_instances i join public.carriages c on c.id::text=i.scope_key and c.event_id=v_event_id where i.run_nonce=v_state.run_nonce and i.mission_code='MISSION_02';
  return jsonb_build_object('contractVersion',2,'status',case when v_state.global_game_state='MISSION_02' then 'active' else 'completed' end,'serverNow',v_now,'deadlineAt',coalesce(v_deadline,v_now),'title','Чёрный ящик','subtitle','ВОССТАНОВЛЕНИЕ ДАННЫХ ПОСЛЕ АВАРИИ','wagons',coalesce(v_wagons,'[]'::jsonb));
end;$$;
revoke all on function public.get_bunker_v2_m02_screen(text) from public,anon,authenticated; grant execute on function public.get_bunker_v2_m02_screen(text) to anon,authenticated;

create function public.get_owner_bunker_v2_m02(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_state public.bunker_state%rowtype; v_now timestamptz:=clock_timestamp(); v_deadline timestamptz; v_wagons jsonb;
begin
  perform public._require_bunker_owner(p_event_id); select s.* into v_state from public.bunker_state s where s.event_id=p_event_id; if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select max(i.deadline_at),jsonb_agg(jsonb_build_object('wagonId',i.scope_key,'label',c.label,'status',case when i.status='completed' then 'completed' else 'active' end,'attemptCount',(select count(*) from public.bunker_mission_decisions d where d.instance_id=i.id and d.decision_key like 'm02_answer_%'),'hintsUsed',(select count(*) from public.bunker_ability_uses u where u.instance_id=i.id and u.status='committed')) order by c.number) into v_deadline,v_wagons from public.bunker_mission_instances i join public.carriages c on c.id::text=i.scope_key and c.event_id=p_event_id where i.run_nonce=v_state.run_nonce and i.mission_code='MISSION_02';
  return jsonb_build_object('contractVersion',2,'status',case when v_state.global_game_state='MISSION_02' then 'active' else 'completed' end,'serverNow',v_now,'deadlineAt',coalesce(v_deadline,v_now),'title','Чёрный ящик','wagons',coalesce(v_wagons,'[]'::jsonb));
end;$$;
revoke all on function public.get_owner_bunker_v2_m02(uuid) from public,anon,authenticated; grant execute on function public.get_owner_bunker_v2_m02(uuid) to authenticated;
