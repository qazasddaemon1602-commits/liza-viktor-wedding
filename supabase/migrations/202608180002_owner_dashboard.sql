create or replace function public.owner_get_dashboard(p_event_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_event public.events%rowtype;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  select e.* into v_event
  from public.events e
  where e.slug = public._normalize_spaces(p_event_slug)
    and e.owner_user_id = v_owner;

  if v_event.id is null then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'status', 'owner',
    'event', jsonb_build_object(
      'id', v_event.id,
      'slug', v_event.slug,
      'name', v_event.name,
      'weddingDate', v_event.wedding_date,
      'eventDate', v_event.event_date,
      'expectedGuestCount', v_event.expected_guest_count,
      'registrationOpen', v_event.registration_open,
      'compositionLocked', v_event.composition_locked,
      'nextTicketSequence', v_event.next_ticket_sequence
    ),
    'state', (
      select jsonb_build_object(
        'currentModule', s.current_module,
        'screenMode', s.screen_mode,
        'screenPinned', s.screen_pinned,
        'updatedAt', s.updated_at
      )
      from public.event_state s
      where s.event_id = v_event.id
    ),
    'carriages', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'number', c.number,
            'label', c.label,
            'accentHex', c.accent_hex,
            'visualMark', c.visual_mark,
            'enabled', c.enabled
          ) order by c.sort_order
        ),
        '[]'::jsonb
      )
      from public.carriages c
      where c.event_id = v_event.id
    ),
    'guests', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', g.id,
            'firstName', g.first_name,
            'lastName', g.last_name,
            'affiliationType', g.affiliation_type,
            'affiliationDetail', coalesce(g.affiliation_detail, ''),
            'ticketNumber', g.ticket_number,
            'registeredAt', g.registered_at,
            'lastSeenAt', g.last_seen_at,
            'carriage', jsonb_build_object(
              'id', c.id,
              'number', c.number,
              'label', c.label,
              'accentHex', c.accent_hex,
              'visualMark', c.visual_mark
            )
          ) order by g.registered_at, g.ticket_sequence
        ),
        '[]'::jsonb
      )
      from public.guests g
      join public.carriages c on c.id = g.carriage_id
      where g.event_id = v_event.id
    ),
    'recentActions', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', log.id,
            'action', log.action,
            'payload', log.payload,
            'createdAt', log.created_at
          ) order by log.created_at desc, log.id desc
        ),
        '[]'::jsonb
      )
      from (
        select l.id, l.action, l.payload, l.created_at
        from public.owner_action_log l
        where l.event_id = v_event.id
          and l.owner_user_id = v_owner
        order by l.created_at desc, l.id desc
        limit 20
      ) log
    )
  );
end;
$$;

revoke all on function public.owner_get_dashboard(text) from public;
grant execute on function public.owner_get_dashboard(text) to authenticated;
