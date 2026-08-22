import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';
const EVENT_SLUG = 'liza-viktor';

async function ownerClient(): Promise<SupabaseClient> {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('E2E Supabase environment is missing');
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (error) throw error;
  return client;
}

async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name as never, args as never);
  if (error) throw error;
  return data as T;
}

async function eventId(client: SupabaseClient): Promise<string> {
  const dashboard = await rpc<Record<string, any>>(client, 'owner_get_dashboard', {
    p_event_slug: EVENT_SLUG,
  });
  const id = String(dashboard?.event?.id ?? '');
  if (!id) throw new Error('E2E event id is missing');
  return id;
}

function commandId(): string {
  return crypto.randomUUID();
}

async function resetGameAndRegistrations(client: SupabaseClient, id: string) {
  await rpc(client, 'owner_bunker_v2_reset_game_and_registrations', {
    p_event_id: id,
    p_confirmation: 'СБРОСИТЬ ИГРУ И РЕГИСТРАЦИИ',
  });
}

async function transition(client: SupabaseClient, id: string, state: string) {
  return rpc<Record<string, any>>(client, 'owner_transition_bunker_v2', {
    p_event_id: id,
    p_next_state: state,
    p_command_id: commandId(),
  });
}

async function simulate(client: SupabaseClient, id: string) {
  return rpc<Record<string, any>>(client, 'owner_bunker_v2_test_simulate_current', {
    p_event_id: id,
  });
}

for (const [guestCount, expectedWagons] of [[15, 2], [20, 3], [30, 4], [40, 5]] as const) {
  test(`Bunker V2 prepares a balanced ${guestCount}-guest rehearsal with ${expectedWagons} wagons`, async () => {
    const client = await ownerClient();
    const id = await eventId(client);

    await resetGameAndRegistrations(client, id).catch(() => undefined);
    const seeded = await rpc<Record<string, any>>(client, 'owner_bunker_v2_seed_test_guests', {
      p_event_id: id,
      p_count: guestCount,
    });
    expect(seeded).toMatchObject({ status: 'seeded', guestCount, wagonCount: expectedWagons });

    const dashboard = await rpc<Record<string, any>>(client, 'owner_get_dashboard', {
      p_event_slug: EVENT_SLUG,
    });
    const enabled = (dashboard.carriages ?? []).filter((wagon: any) => wagon.enabled);
    const sizes = enabled.map((wagon: any) =>
      (dashboard.guests ?? []).filter((guest: any) => guest.carriage?.id === wagon.id).length,
    );
    expect(enabled).toHaveLength(expectedWagons);
    expect(sizes.reduce((sum: number, value: number) => sum + value, 0)).toBe(guestCount);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);

    const prepared = await rpc<Record<string, any>>(client, 'owner_prepare_bunker_v2_test', {
      p_event_id: id,
      p_command_id: commandId(),
    });
    expect(prepared).toMatchObject({
      status: 'prepared',
      contractVersion: 2,
      globalGameState: 'LOBBY',
      guestCount,
      wagonCount: expectedWagons,
      gameMode: 'test',
    });

    await resetGameAndRegistrations(client, id);
    await client.auth.signOut();
  });
}

test('Bunker V2 rehearsal can traverse the entire story without a dead end', async () => {
  const client = await ownerClient();
  const id = await eventId(client);
  await resetGameAndRegistrations(client, id).catch(() => undefined);

  await rpc(client, 'owner_bunker_v2_seed_test_guests', { p_event_id: id, p_count: 20 });
  await rpc(client, 'owner_prepare_bunker_v2_test', {
    p_event_id: id,
    p_command_id: commandId(),
  });

  await transition(client, id, 'CHARACTERS_READY');
  await transition(client, id, 'MISSION_01');
  expect(await simulate(client, id)).toMatchObject({ status: 'simulated', state: 'MISSION_01' });
  await transition(client, id, 'BREAK');

  for (const stage of ['MISSION_02', 'MISSION_03', 'MISSION_04', 'MISSION_05', 'MISSION_06']) {
    await transition(client, id, stage);
    expect(await simulate(client, id)).toMatchObject({ status: 'simulated', state: stage });
  }

  const story = await transition(client, id, 'UNKNOWN_PASSENGER');
  expect(story.globalGameState).toBe('UNKNOWN_PASSENGER');

  const ownerStory = await rpc<Record<string, any>>(client, 'get_owner_bunker_v2_unknown_passenger', {
    p_event_id: id,
  });
  expect(ownerStory).toMatchObject({ status: 'active', dossierId: 'BK-17', sector: '04' });

  await transition(client, id, 'BREAK_BEFORE_FINAL');
  const finalTransition = await transition(client, id, 'FINAL_30');
  expect(finalTransition.globalGameState).toBe('FINAL_30');

  const finalBefore = await rpc<Record<string, any>>(client, 'get_owner_bunker_v2_final', {
    p_event_id: id,
  });
  expect(finalBefore).toMatchObject({ contractVersion: 2, status: 'active', total: 5 });

  const simulatedFinal = await simulate(client, id);
  expect(simulatedFinal).toMatchObject({ status: 'simulated', state: 'FINAL_30', opened: true });

  const finalAfter = await rpc<Record<string, any>>(client, 'get_owner_bunker_v2_final', {
    p_event_id: id,
  });
  expect(finalAfter.unlocked).toBe(true);

  const testState = await rpc<Record<string, any>>(client, 'get_owner_bunker_v2_test_state', {
    p_event_id: id,
  });
  expect(['BUNKER_OPEN', 'FINAL_30']).toContain(testState.globalState);

  await resetGameAndRegistrations(client, id);
  await client.auth.signOut();
});
