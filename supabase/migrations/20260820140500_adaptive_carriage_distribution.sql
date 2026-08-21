create or replace function public.owner_apply_carriage_distribution(
  p_event_id uuid,
  p_carriage_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_registered_guest_count integer := 0;
  v_available_carriage_count integer := 0;
  v_carriage_sizes jsonb := '[]'::jsonb;
begin
  if v_owner is null then
    raise exception 'owner authentication required' using errcode = '42501';
  end if;

  if p_carriage_count is null or p_carriage_count not between 2 and 5 then
    raise exception 'carriage count must be between 2 and 5' using errcode = '22023';
  end if;

  perform 1
  from public.events e
  where e.id = p_event_id
    and e.owner_user_id = v_owner
  for update;

  if not found then
    raise exception 'owner access required or event not found' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.bunker_state bs
    where bs.event_id = p_event_id
      and bs.status = 'active'
  ) then
    raise exception 'cannot redistribute carriages while Bunker is active' using errcode = '55000';
  end if;

  select count(*)::integer
  into v_available_carriage_count
  from public.carriages c
  where c.event_id = p_event_id;

  if v_available_carriage_count < p_carriage_count then
    raise exception 'not enough carriages configured for event' using errcode = '55000';
  end if;

  update public.carriages c
  set enabled = c.id in (
    select selected.id
    from public.carriages selected
    where selected.event_id = p_event_id
    order by selected.sort_order, selected.number, selected.id
    limit p_carriage_count
  )
  where c.event_id = p_event_id;

  with ranked_guests as (
    select
      g.id,
      g.affiliation_type,
      g.registered_at,
      row_number() over (
        partition by g.affiliation_type
        order by g.registered_at, g.id
      ) as affiliation_rank
    from public.guests g
    where g.event_id = p_event_id
  ),
  ordered_guests as (
    select
      rg.id,
      row_number() over (
        order by rg.affiliation_rank, rg.affiliation_type, rg.registered_at, rg.id
      ) as distribution_position
    from ranked_guests rg
  ),
  active_carriages as (
    select
      c.id,
      row_number() over (order by c.number, c.id) as distribution_position
    from public.carriages c
    where c.event_id = p_event_id
      and c.enabled
  ),
  assignments as (
    select
      og.id as guest_id,
      ac.id as carriage_id
    from ordered_guests og
    join active_carriages ac
      on ac.distribution_position = ((og.distribution_position - 1) % p_carriage_count) + 1
  )
  update public.guests g
  set carriage_id = a.carriage_id
  from assignments a
  where g.id = a.guest_id;

  get diagnostics v_registered_guest_count = row_count;

  update public.events e
  set composition_locked = true
  where e.id = p_event_id;

  select coalesce(jsonb_agg(summary.guest_count order by summary.number), '[]'::jsonb)
  into v_carriage_sizes
  from (
    select c.number, count(g.id)::integer as guest_count
    from public.carriages c
    left join public.guests g
      on g.event_id = c.event_id
      and g.carriage_id = c.id
    where c.event_id = p_event_id
      and c.enabled
    group by c.id, c.number
  ) summary;

  insert into public.owner_action_log(event_id, owner_user_id, action, payload)
  values (
    p_event_id,
    v_owner,
    'carriage_distribution_applied',
    jsonb_build_object(
      'activeCarriageCount', p_carriage_count,
      'registeredGuestCount', v_registered_guest_count,
      'carriageSizes', v_carriage_sizes
    )
  );

  return jsonb_build_object(
    'status', 'locked',
    'activeCarriageCount', p_carriage_count,
    'registeredGuestCount', v_registered_guest_count,
    'carriageSizes', v_carriage_sizes,
    'registrationOpen', true
  );
end;
$$;

revoke all on function public.owner_apply_carriage_distribution(uuid, integer) from public, anon;
grant execute on function public.owner_apply_carriage_distribution(uuid, integer) to authenticated;
