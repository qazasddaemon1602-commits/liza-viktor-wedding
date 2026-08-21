-- Repair legacy owner RPCs that selected a table alias as one composite value
-- into a %rowtype variable. PostgreSQL then attempted to cast the complete row
-- literal into the first UUID field. Patch the deployed definitions in place so
-- their established behavior stays intact while correcting row assignment.
do $migration$
declare
  v_signatures text[] := array[
    'public.owner_remove_mk_player(uuid)',
    'public.owner_swap_mk_seeds(uuid,uuid)',
    'public.owner_replace_mk_player(uuid,uuid)',
    'public.owner_set_current_mk_match(uuid)',
    'public.owner_record_mk_winner(uuid,uuid,boolean)',
    'public.owner_undo_mk_result(uuid,boolean)'
  ];
  v_needles text[] := array[
    'select r into v_registration',
    'select r into v_a',
    'select r into v_registration',
    'select m into v_match',
    'select m into v_match',
    'select m into v_match'
  ];
  v_replacements text[] := array[
    'select r.* into v_registration',
    'select r.* into v_a',
    'select r.* into v_registration',
    'select m.* into v_match',
    'select m.* into v_match',
    'select m.* into v_match'
  ];
  v_definition text;
  v_fixed text;
  v_index integer;
begin
  for v_index in 1..array_length(v_signatures, 1) loop
    select pg_get_functiondef(to_regprocedure(v_signatures[v_index]))
    into v_definition;

    if v_definition is null then
      raise exception 'required MK function is missing: %', v_signatures[v_index];
    end if;
    if position(v_needles[v_index] in lower(v_definition)) = 0 then
      raise exception 'expected composite-row assignment not found in %', v_signatures[v_index];
    end if;

    v_fixed := replace(v_definition, v_needles[v_index], v_replacements[v_index]);

    -- owner_swap_mk_seeds has a second affected row variable.
    if v_signatures[v_index] = 'public.owner_swap_mk_seeds(uuid,uuid)' then
      if position('select r into v_b' in lower(v_fixed)) = 0 then
        raise exception 'expected second composite-row assignment not found in %', v_signatures[v_index];
      end if;
      v_fixed := replace(v_fixed, 'select r into v_b', 'select r.* into v_b');
    end if;

    -- Re-created SECURITY DEFINER functions must keep the hardened empty path.
    v_fixed := replace(v_fixed, 'SET search_path TO ''public''', 'SET search_path TO ''''');
    execute v_fixed;
  end loop;
end;
$migration$;

revoke all on function public.owner_remove_mk_player(uuid) from public, anon;
revoke all on function public.owner_swap_mk_seeds(uuid, uuid) from public, anon;
revoke all on function public.owner_replace_mk_player(uuid, uuid) from public, anon;
revoke all on function public.owner_set_current_mk_match(uuid) from public, anon;
revoke all on function public.owner_record_mk_winner(uuid, uuid, boolean) from public, anon;
revoke all on function public.owner_undo_mk_result(uuid, boolean) from public, anon;

grant execute on function public.owner_remove_mk_player(uuid) to authenticated;
grant execute on function public.owner_swap_mk_seeds(uuid, uuid) to authenticated;
grant execute on function public.owner_replace_mk_player(uuid, uuid) to authenticated;
grant execute on function public.owner_set_current_mk_match(uuid) to authenticated;
grant execute on function public.owner_record_mk_winner(uuid, uuid, boolean) to authenticated;
grant execute on function public.owner_undo_mk_result(uuid, boolean) to authenticated;
