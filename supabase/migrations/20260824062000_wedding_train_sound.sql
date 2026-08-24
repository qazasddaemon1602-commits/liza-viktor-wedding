create or replace function public.owner_send_train_sound(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_event_id uuid;
  v_screen_event_id uuid;
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
    'train_sound',
    '{}'::jsonb,
    true,
    now() + interval '15 seconds'
  )
  returning id into v_screen_event_id;

  return jsonb_build_object(
    'status', 'sent',
    'eventId', v_screen_event_id
  );
end;
$$;

revoke all on function public.owner_send_train_sound(text) from public, anon;
grant execute on function public.owner_send_train_sound(text) to authenticated;
