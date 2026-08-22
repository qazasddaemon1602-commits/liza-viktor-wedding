-- Keep owner read models on the exact same V1/V2 contract boundary as the
-- corresponding public TV projections. Owner authorization happens first;
-- the delegated screen functions remain responsible for contract_version=2.

create or replace function public.get_owner_bunker_v2_m03(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  perform public._require_bunker_owner(p_event_id);
  select event.slug into v_slug
  from public.events event
  where event.id = p_event_id;
  if v_slug is null then
    raise exception 'Bunker event not found' using errcode = 'P0002';
  end if;
  return public.get_bunker_v2_m03_screen(v_slug);
end;
$$;

create or replace function public.get_owner_bunker_v2_m04(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  perform public._require_bunker_owner(p_event_id);
  select event.slug into v_slug
  from public.events event
  where event.id = p_event_id;
  if v_slug is null then
    raise exception 'Bunker event not found' using errcode = 'P0002';
  end if;
  return public.get_bunker_v2_m04_screen(v_slug);
end;
$$;

create or replace function public.get_owner_bunker_v2_m05(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  perform public._require_bunker_owner(p_event_id);
  select event.slug into v_slug
  from public.events event
  where event.id = p_event_id;
  if v_slug is null then
    raise exception 'Bunker event not found' using errcode = 'P0002';
  end if;
  return public.get_bunker_v2_m05_screen(v_slug);
end;
$$;

create or replace function public.get_owner_bunker_v2_m06(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  perform public._require_bunker_owner(p_event_id);
  select event.slug into v_slug
  from public.events event
  where event.id = p_event_id;
  if v_slug is null then
    raise exception 'Bunker event not found' using errcode = 'P0002';
  end if;
  return public.get_bunker_v2_m06_screen(v_slug);
end;
$$;

revoke all on function public.get_owner_bunker_v2_m03(uuid) from public, anon, authenticated;
revoke all on function public.get_owner_bunker_v2_m04(uuid) from public, anon, authenticated;
revoke all on function public.get_owner_bunker_v2_m05(uuid) from public, anon, authenticated;
revoke all on function public.get_owner_bunker_v2_m06(uuid) from public, anon, authenticated;

grant execute on function public.get_owner_bunker_v2_m03(uuid) to authenticated;
grant execute on function public.get_owner_bunker_v2_m04(uuid) to authenticated;
grant execute on function public.get_owner_bunker_v2_m05(uuid) to authenticated;
grant execute on function public.get_owner_bunker_v2_m06(uuid) to authenticated;
