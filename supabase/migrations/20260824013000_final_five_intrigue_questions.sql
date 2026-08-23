update public.questions q
set text = case q.sort_order
      when 101 then 'Кто из вас первым поймёт, что второй расстроен, даже если услышит: «Всё нормально»?'
      when 102 then 'Кому из вас сложнее первым признать: «Да, тут я был(а) неправ(а)»?'
      when 103 then 'Кто из вас скорее однажды скажет: «А давай всё бросим и куда-нибудь уедем»?'
      when 104 then 'Кто из вас лучше понимает, чего хочет второй, ещё до того, как тот сам это сформулировал?'
      when 105 then 'Кто из вас через десять лет всё ещё будет чаще устраивать другому неожиданные сюрпризы?'
      else q.text
    end,
    updated_at = now()
from public.events e
where e.id = q.event_id
  and e.slug = 'liza-viktor'
  and q.question_type = 'final_five'
  and q.sort_order between 101 and 105;

create or replace function public.owner_seed_final_five_questions(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_count integer := 0;
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

  insert into public.questions(event_id, text, question_type, sort_order, enabled)
  values
    (p_event_id, 'Кто из вас первым поймёт, что второй расстроен, даже если услышит: «Всё нормально»?', 'final_five', 101, true),
    (p_event_id, 'Кому из вас сложнее первым признать: «Да, тут я был(а) неправ(а)»?', 'final_five', 102, true),
    (p_event_id, 'Кто из вас скорее однажды скажет: «А давай всё бросим и куда-нибудь уедем»?', 'final_five', 103, true),
    (p_event_id, 'Кто из вас лучше понимает, чего хочет второй, ещё до того, как тот сам это сформулировал?', 'final_five', 104, true),
    (p_event_id, 'Кто из вас через десять лет всё ещё будет чаще устраивать другому неожиданные сюрпризы?', 'final_five', 105, true)
  on conflict (event_id, sort_order) do update
  set text = excluded.text,
      question_type = 'final_five',
      enabled = true,
      updated_at = now();

  select count(*)::integer
  into v_count
  from public.questions q
  where q.event_id = p_event_id
    and q.question_type = 'final_five'
    and q.enabled;

  return jsonb_build_object('status', 'ready', 'questionCount', v_count);
end;
$$;

revoke all on function public.owner_seed_final_five_questions(uuid) from public, anon;
grant execute on function public.owner_seed_final_five_questions(uuid) to authenticated;
