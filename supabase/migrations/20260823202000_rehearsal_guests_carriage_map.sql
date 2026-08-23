create or replace function public.get_registration_carriage_map(
  p_event_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_expected_guest_count integer;
  v_map_expected_guest_count integer;
  v_registered_guest_count integer;
  v_unassigned_count integer;
  v_test_guest_count integer := 0;
  v_game_mode text;
  v_run_nonce uuid;
  v_include_test boolean := false;
  v_carriages jsonb;
  v_server_now timestamptz := pg_catalog.statement_timestamp();
begin
  select event.id, event.expected_guest_count
  into v_event_id, v_expected_guest_count
  from public.events event
  where event.slug = pg_catalog.btrim(coalesce(p_event_slug, ''));

  if v_event_id is null then
    return pg_catalog.jsonb_build_object(
      'status', 'not_found',
      'expectedGuestCount', 0,
      'registeredGuestCount', 0,
      'serverNow', v_server_now,
      'unassignedCount', 0,
      'carriages', '[]'::jsonb
    );
  end if;

  select state.game_mode, state.run_nonce
  into v_game_mode, v_run_nonce
  from public.bunker_state state
  where state.event_id = v_event_id;

  select pg_catalog.count(*)::integer
  into v_test_guest_count
  from public.guests guest
  where guest.event_id = v_event_id
    and guest.affiliation_detail = '__BUNKER_TEST__';

  -- Synthetic passengers are intentionally visible while setting up a
  -- rehearsal (no run yet) and throughout an explicit test-mode run. Once a
  -- production run exists they stay hidden from the public registration map.
  v_include_test := v_test_guest_count > 0
    and (v_game_mode = 'test' or v_run_nonce is null);

  select pg_catalog.count(*)::integer
  into v_registered_guest_count
  from public.guests guest
  where guest.event_id = v_event_id
    and (
      v_include_test
      or guest.affiliation_detail is distinct from '__BUNKER_TEST__'
    );

  v_map_expected_guest_count := case
    when v_include_test then v_registered_guest_count
    else v_expected_guest_count
  end;

  select pg_catalog.count(*)::integer
  into v_unassigned_count
  from public.guests guest
  where guest.event_id = v_event_id
    and (
      v_include_test
      or guest.affiliation_detail is distinct from '__BUNKER_TEST__'
    )
    and not exists (
      select 1
      from public.carriages carriage
      where carriage.id = guest.carriage_id
        and carriage.event_id = v_event_id
        and carriage.enabled
    );

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', ordered_carriage.id,
        'number', ordered_carriage.number,
        'label', ordered_carriage.label,
        'accentHex', ordered_carriage.accent_hex,
        'visualMark', ordered_carriage.visual_mark,
        'guests', ordered_carriage.guests
      )
      order by
        ordered_carriage.sort_order,
        ordered_carriage.number,
        ordered_carriage.id
    ),
    '[]'::jsonb
  )
  into v_carriages
  from (
    select
      carriage.id,
      carriage.number,
      carriage.label,
      carriage.accent_hex,
      carriage.visual_mark,
      carriage.sort_order,
      coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'id', ordered_guest.id,
              'initials', ordered_guest.initials,
              'seatIndex', ordered_guest.seat_index
            )
            order by ordered_guest.seat_index
          )
          from (
            select
              guest.id,
              coalesce(
                nullif(
                  pg_catalog.left(
                    pg_catalog.upper(
                      pg_catalog.concat(
                        pg_catalog.left(
                          pg_catalog.regexp_replace(
                            guest.first_name,
                            '[^[:alpha:]]',
                            '',
                            'g'
                          ),
                          1
                        ),
                        pg_catalog.left(
                          pg_catalog.regexp_replace(
                            guest.last_name,
                            '[^[:alpha:]]',
                            '',
                            'g'
                          ),
                          1
                        )
                      )
                    ),
                    2
                  ),
                  ''
                ),
                'Г'
              ) as initials,
              pg_catalog.row_number() over (
                order by
                  guest.registered_at,
                  guest.ticket_sequence,
                  guest.id
              ) as seat_index
            from public.guests guest
            where guest.event_id = v_event_id
              and guest.carriage_id = carriage.id
              and (
                v_include_test
                or guest.affiliation_detail is distinct from '__BUNKER_TEST__'
              )
          ) ordered_guest
        ),
        '[]'::jsonb
      ) as guests
    from public.carriages carriage
    where carriage.event_id = v_event_id
      and carriage.enabled
  ) ordered_carriage;

  return pg_catalog.jsonb_build_object(
    'status', case
      when v_map_expected_guest_count > 0
        and v_registered_guest_count >= least(
          v_map_expected_guest_count,
          40
        )
        then 'complete'
      else 'registration'
    end,
    'expectedGuestCount', v_map_expected_guest_count,
    'registeredGuestCount', v_registered_guest_count,
    'serverNow', v_server_now,
    'unassignedCount', v_unassigned_count,
    'carriages', v_carriages
  );
end;
$$;

revoke all on function public.get_registration_carriage_map(text)
from public;

grant execute on function public.get_registration_carriage_map(text)
to anon, authenticated;
