-- Forward-only defense in depth: a wagon entitlement must match both carriage_id
-- and owner_scope_key before it is visible to the registered device guest.
create or replace function public.get_guest_bunker_v2_dashboard(
  p_event_slug text,
  p_device_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_guest public.guests%rowtype;
  v_state public.bunker_state%rowtype;
  v_contract_version integer;
  v_wagon public.carriages%rowtype;
  v_passengers jsonb := '[]'::jsonb;
  v_inventory jsonb := '[]'::jsonb;
  v_archive jsonb := '[]'::jsonb;
  v_wagon_state public.bunker_wagon_state%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  select event.id into v_event_id
  from public.events event
  where event.slug = public._normalize_spaces(p_event_slug);
  if v_event_id is null then
    return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now);
  end if;

  select guest.* into v_guest
  from public.guests guest
  where guest.event_id = v_event_id
    and guest.id = public._bunker_guest_id(p_event_slug, p_device_key);
  if v_guest.id is null or v_guest.carriage_id is null then
    return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now);
  end if;

  select state.* into v_state from public.bunker_state state where state.event_id = v_event_id;
  if v_state.run_nonce is null then
    return jsonb_build_object('contractVersion',2,'status','idle','serverNow',v_now);
  end if;
  select run.contract_version into v_contract_version
  from public.bunker_game_runs run
  where run.event_id = v_event_id and run.run_nonce = v_state.run_nonce;
  if v_contract_version is distinct from 2 then
    return jsonb_build_object('contractVersion',2,'status','legacy','serverNow',v_now);
  end if;

  select carriage.* into v_wagon
  from public.carriages carriage
  where carriage.id = v_guest.carriage_id
    and carriage.event_id = v_event_id
    and carriage.enabled;
  if v_wagon.id is null then
    return jsonb_build_object('contractVersion',2,'status','not_found','serverNow',v_now);
  end if;

  select coalesce(
    jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'guestId', passenger.id,
      'realName', public._normalize_spaces(concat_ws(' ', passenger.first_name, passenger.last_name)),
      'profession', profile.profession,
      'visibleSkill', profile.visible_skill,
      'characterStatus', profile.character_status,
      'hiddenTraitRevealed', profile.hidden_trait_revealed,
      'hiddenTrait', case when profile.hidden_trait_revealed then profile.hidden_fact else null end
    )) order by passenger.registered_at, passenger.id),
    '[]'::jsonb
  ) into v_passengers
  from public.guests passenger
  join public.bunker_guest_profiles profile
    on profile.event_id = v_event_id
   and profile.run_nonce = v_state.run_nonce
   and profile.guest_id = passenger.id
  where passenger.event_id = v_event_id
    and passenger.carriage_id = v_guest.carriage_id;

  with item_keys as (
    select lot.item_key
    from public.bunker_inventory_lots lot
    where lot.event_id = v_event_id and lot.run_nonce = v_state.run_nonce
      and lot.carriage_id = v_guest.carriage_id
    union
    select transfer.item_key
    from public.bunker_inventory_transfers transfer
    where transfer.event_id = v_event_id and transfer.run_nonce = v_state.run_nonce
      and transfer.from_carriage_id = v_guest.carriage_id and transfer.status = 'accepted'
  ), lot_totals as (
    select lot.item_key,
      coalesce(sum(lot.quantity) filter (where lot.status = 'available'),0)::integer as available,
      coalesce(sum(lot.quantity) filter (where lot.status = 'used'),0)::integer as used,
      coalesce(sum(lot.quantity) filter (where lot.status = 'lost'),0)::integer as lost
    from public.bunker_inventory_lots lot
    where lot.event_id = v_event_id and lot.run_nonce = v_state.run_nonce
      and lot.carriage_id = v_guest.carriage_id
    group by lot.item_key
  ), transfer_totals as (
    select transfer.item_key, coalesce(sum(transfer.quantity),0)::integer as transferred
    from public.bunker_inventory_transfers transfer
    where transfer.event_id = v_event_id and transfer.run_nonce = v_state.run_nonce
      and transfer.from_carriage_id = v_guest.carriage_id and transfer.status = 'accepted'
    group by transfer.item_key
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'itemKey', item.item_key,
    'available', coalesce(lot.available,0),
    'used', coalesce(lot.used,0),
    'transferred', coalesce(transfer.transferred,0),
    'lost', coalesce(lot.lost,0)
  ) order by item.item_key),'[]'::jsonb)
  into v_inventory
  from item_keys item
  left join lot_totals lot on lot.item_key = item.item_key
  left join transfer_totals transfer on transfer.item_key = item.item_key;

  select coalesce(jsonb_agg(jsonb_build_object(
    'artifactKey', archive.artifact_key,
    'contentType', archive.content_type,
    'decryptionStatus', archive.decryption_status,
    'scope', archive.scope
  ) order by archive.acquired_at, archive.artifact_key),'[]'::jsonb)
  into v_archive
  from (
    select distinct on (entry.id)
      entry.id, entry.artifact_key, entry.content_type, entry.decryption_status, entry.acquired_at,
      case when entitlement.owner_scope_kind = 'global' then 'global' else 'wagon' end as scope
    from public.bunker_archive_entitlements entitlement
    join public.bunker_archive_entries entry
      on entry.id = entitlement.archive_entry_id
     and entry.event_id = v_event_id
     and entry.run_nonce = v_state.run_nonce
    where entitlement.event_id = v_event_id
      and entitlement.run_nonce = v_state.run_nonce
      and entitlement.status = 'active'
      and (
        entitlement.owner_scope_kind = 'global'
        or (
          entitlement.owner_scope_kind = 'wagon'
          and entitlement.carriage_id = v_guest.carriage_id
          and entitlement.owner_scope_key = v_guest.carriage_id::text
        )
      )
    order by entry.id, case when entitlement.owner_scope_kind = 'global' then 0 else 1 end
  ) archive;

  select wagon_state.* into v_wagon_state
  from public.bunker_wagon_state wagon_state
  where wagon_state.event_id = v_event_id
    and wagon_state.run_nonce = v_state.run_nonce
    and wagon_state.carriage_id = v_guest.carriage_id;
  if v_wagon_state.carriage_id is null then
    raise exception 'Bunker V2 wagon state missing' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'contractVersion',2,'status','active','serverNow',v_now,
    'wagon',jsonb_build_object('id',v_wagon.id,'number',v_wagon.number,'label',v_wagon.label),
    'passengers',v_passengers,'inventory',v_inventory,'archive',v_archive,
    'wagonState',jsonb_build_object(
      'powerStatus',v_wagon_state.power_status,
      'communicationStatus',v_wagon_state.communication_status,
      'navigationStatus',v_wagon_state.navigation_status,
      'technicalDoorStatus',v_wagon_state.technical_door_status,
      'trackDamage',v_wagon_state.track_damage,
      'waterStatus',v_wagon_state.water_status,
      'routeChoice',v_wagon_state.route_choice,
      'routeBonus',v_wagon_state.route_bonus,
      'powerInstability',v_wagon_state.power_instability,
      'sector04Found',v_wagon_state.sector04_found,
      'coordinationBonus',v_wagon_state.coordination_bonus
    )
  );
end;
$$;
revoke all on function public.get_guest_bunker_v2_dashboard(text,text) from public,anon,authenticated;
grant execute on function public.get_guest_bunker_v2_dashboard(text,text) to anon,authenticated;
