-- Persisted owner read model for rehearsal mode. No gameplay secrets are returned.
create or replace function public.get_owner_bunker_v2_test_state(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_state public.bunker_state%rowtype;v_guests integer;v_wagons integer;begin
 perform public._require_bunker_owner(p_event_id);
 select s.* into v_state from public.bunker_state s where s.event_id=p_event_id;
 select count(*)::integer into v_guests from public.guests g where g.event_id=p_event_id;
 select count(*)::integer into v_wagons from public.carriages c where c.event_id=p_event_id and c.enabled;
 return jsonb_build_object(
   'gameMode',case when v_state.run_nonce is null then 'idle' else v_state.game_mode end,
   'globalState',case when v_state.run_nonce is null then null else v_state.global_game_state end,
   'runActive',v_state.run_nonce is not null,
   'guestCount',coalesce(v_guests,0),
   'wagonCount',coalesce(v_wagons,0)
 );
end;$$;
revoke all on function public.get_owner_bunker_v2_test_state(uuid) from public,anon,authenticated;
grant execute on function public.get_owner_bunker_v2_test_state(uuid) to authenticated;
