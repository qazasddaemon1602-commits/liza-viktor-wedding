-- Forward-only compatibility fix: guests stores first_name/last_name, not real_name.
create or replace function public.get_guest_bunker_v2_m04(p_event_slug text,p_device_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_event_id uuid; v_guest public.guests%rowtype; v_state public.bunker_state%rowtype;
  v_run public.bunker_game_runs%rowtype; v_instance public.bunker_mission_instances%rowtype;
  v_member public.bunker_mission_members%rowtype; v_profile public.bunker_guest_profiles%rowtype;
  v_group_wagons jsonb; v_messages jsonb; v_inventory jsonb; v_trades jsonb; v_answer text;
  v_answered integer; v_total integer; v_quota integer; v_message_count integer; v_ability jsonb:=null;
  v_now timestamptz:=clock_timestamp();
begin
  select e.id into v_event_id from public.events e where e.slug=public._normalize_spaces(p_event_slug);
  if v_event_id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;
  select g.* into v_guest from public.guests g where g.event_id=v_event_id and g.id=public._bunker_guest_id(p_event_slug,p_device_key);
  if v_guest.id is null then return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now); end if;
  select s.* into v_state from public.bunker_state s where s.event_id=v_event_id;
  if v_state.run_nonce is null then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select r.* into v_run from public.bunker_game_runs r where r.event_id=v_event_id and r.run_nonce=v_state.run_nonce;
  if v_run.contract_version<>2 then return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now); end if;
  select i.* into v_instance from public.bunker_mission_instances i where i.run_nonce=v_state.run_nonce and i.mission_code='MISSION_04' and i.definition->'wagonIds' @> jsonb_build_array(v_guest.carriage_id) limit 1;
  if v_instance.id is null or v_state.global_game_state not in ('MISSION_04','MISSION_05','MISSION_06','UNKNOWN_PASSENGER','BREAK_BEFORE_FINAL','FINAL_30','BUNKER_OPEN','FINISHED') then return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now); end if;
  select m.* into v_member from public.bunker_mission_members m where m.instance_id=v_instance.id and m.guest_id=v_guest.id;
  select p.* into v_profile from public.bunker_guest_profiles p where p.run_nonce=v_state.run_nonce and p.guest_id=v_guest.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'number',c.number,'label',c.label) order by c.number),'[]'::jsonb) into v_group_wagons from public.carriages c where c.id in (select value::uuid from jsonb_array_elements_text(v_instance.definition->'wagonIds'));
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'fromWagonLabel',c.label,'senderName',public._normalize_spaces(concat_ws(' ',g.first_name,g.last_name)),'message',m.message,'createdAt',m.created_at) order by m.created_at),'[]'::jsonb)
    into v_messages
    from public.bunker_intercarriage_messages m
    join public.carriages c on c.id=m.from_carriage_id
    join public.guests g on g.id=m.from_guest_id
    where m.instance_id=v_instance.id;
  select coalesce(jsonb_agg(jsonb_build_object('itemKey',x.item_key,'quantity',x.qty) order by x.item_key),'[]'::jsonb) into v_inventory from (select item_key,sum(quantity)::integer qty from public.bunker_inventory_lots where run_nonce=v_state.run_nonce and carriage_id=v_guest.carriage_id and status='available' group by item_key)x;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'direction',case when t.to_carriage_id=v_guest.carriage_id then 'incoming' else 'outgoing' end,'otherWagonLabel',case when t.to_carriage_id=v_guest.carriage_id then from_c.label else to_c.label end,'itemKey',t.item_key,'quantity',t.quantity,'status',t.status) order by t.offered_at desc),'[]'::jsonb) into v_trades from public.bunker_inventory_transfers t join public.carriages from_c on from_c.id=t.from_carriage_id join public.carriages to_c on to_c.id=t.to_carriage_id where t.instance_id=v_instance.id and (t.from_carriage_id=v_guest.carriage_id or t.to_carriage_id=v_guest.carriage_id);
  select d.payload->>'answer' into v_answer from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key='m04_answer' and d.actor_kind='wagon' and d.actor_scope_key=v_guest.carriage_id::text limit 1;
  select count(*)::integer into v_answered from public.bunker_mission_decisions d where d.instance_id=v_instance.id and d.decision_key='m04_answer' and d.status='confirmed';
  v_total:=jsonb_array_length(v_instance.definition->'wagonIds');
  select count(*)::integer into v_message_count from public.bunker_intercarriage_messages m where m.instance_id=v_instance.id and m.from_carriage_id=v_guest.carriage_id;
  v_quota:=case when v_profile.special_ability='extra_message' and (v_profile.ability_uses_remaining>0 or exists(select 1 from public.bunker_ability_uses u where u.instance_id=v_instance.id and u.guest_id=v_guest.id and u.ability_key='extra_message')) then 4 else 3 end;
  if v_profile.special_ability='clarification' then v_ability:=jsonb_build_object('available',v_profile.ability_uses_remaining>0 and not exists(select 1 from public.bunker_ability_uses u where u.run_nonce=v_state.run_nonce and u.guest_id=v_guest.id and u.ability_key='clarification'),'key','clarification','label','Уточнение сообщения','hint',coalesce((select u.effect->>'hint' from public.bunker_ability_uses u where u.instance_id=v_instance.id and u.guest_id=v_guest.id and u.ability_key='clarification' limit 1),'Можно один раз получить подсказку, как сверить формулировки вагонов.')); end if;
  return jsonb_build_object('contractVersion',2,'status',case when v_instance.status='completed' then 'completed' else 'active' end,'serverNow',v_now,'deadlineAt',coalesce(v_instance.deadline_at,v_now),'instanceId',v_instance.id,'instanceVersion',v_instance.instance_version,'title',v_instance.definition->>'title','interactionPhase',coalesce(v_instance.definition->>'interactionPhase','exchange'),'group',jsonb_build_object('key',v_instance.scope_key,'wagons',v_group_wagons),'viewer',jsonb_build_object('wagonId',v_guest.carriage_id,'wagonNumber',(select c.number from public.carriages c where c.id=v_guest.carriage_id),'isOperator',v_member.member_role='operator'),'messageQuota',v_quota,'messagesRemaining',greatest(0,v_quota-v_message_count),'messages',v_messages,'inventory',v_inventory,'trades',v_trades,'answer',jsonb_build_object('options',v_instance.definition->'answerOptions','selected',v_answer,'answeredWagons',v_answered,'totalWagons',v_total),'ability',v_ability);
end;$$;
revoke all on function public.get_guest_bunker_v2_m04(text,text) from public,anon,authenticated;
grant execute on function public.get_guest_bunker_v2_m04(text,text) to anon,authenticated;
