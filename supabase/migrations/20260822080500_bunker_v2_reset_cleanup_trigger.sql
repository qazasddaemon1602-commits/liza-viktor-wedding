-- Forward-only reset hardening.
-- The dependency-safe cleanup function was introduced earlier, but it was not
-- attached to bunker_state. Detach the authoritative run first, then remove
-- only that run's V2 projection graph.

drop trigger if exists bunker_v2_clear_game_run_on_reset on public.bunker_state;
create trigger bunker_v2_clear_game_run_on_reset
after update of run_nonce on public.bunker_state
for each row
when (old.run_nonce is not null and new.run_nonce is null)
execute function public._clear_bunker_game_run_on_reset();
