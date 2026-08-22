import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';
const EVENT_SLUG = 'liza-viktor';

function publicClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('E2E Supabase environment is missing');
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ownerClient(): Promise<SupabaseClient> {
  const client = publicClient();
  const { error } = await client.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  if (error) throw error;
  return client;
}

async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name as never, args as never);
  if (error) throw error;
  return data as T;
}

async function eventId(client: SupabaseClient): Promise<string> {
  const dashboard = await rpc<Record<string, any>>(client, 'owner_get_dashboard', { p_event_slug: EVENT_SLUG });
  const id = String(dashboard?.event?.id ?? '');
  if (!id) throw new Error('E2E event id is missing');
  return id;
}

function commandId(): string { return crypto.randomUUID(); }

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
  return rpc<Record<string, any>>(client, 'owner_bunker_v2_test_simulate_current', { p_event_id: id });
}

async function registerDeviceGuest(client: SupabaseClient, deviceKey: string) {
  const result = await rpc<Record<string, any>>(client, 'register_guest', {
    p_event_slug: EVENT_SLUG,
    p_device_key: deviceKey,
    p_first_name: 'E2E',
    p_last_name: 'Dashboard',
    p_affiliation_type: 'common',
    p_affiliation_detail: 'persistent-dashboard',
    p_confirm_duplicate: true,
  });
  expect(result.status).toBe('registered');
  return result.guest as Record<string, any>;
}

async function guestDashboard(client: SupabaseClient, deviceKey: string) {
  return rpc<Record<string, any>>(client, 'get_guest_bunker_v2_dashboard', {
    p_event_slug: EVENT_SLUG,
    p_device_key: deviceKey,
  });
}

for (const [guestCount, expectedWagons] of [[15, 2], [20, 3], [30, 4], [40, 5]] as const) {
  test(`Bunker V2 prepares a balanced ${guestCount}-guest rehearsal with ${expectedWagons} wagons`, async () => {
    const client = await ownerClient();
    const id = await eventId(client);

    await resetGameAndRegistrations(client, id);
    const seeded = await rpc<Record<string, any>>(client, 'owner_bunker_v2_seed_test_guests', {
      p_event_id: id,
      p_count: guestCount,
    });
    expect(seeded).toMatchObject({ status: 'seeded', guestCount, wagonCount: expectedWagons });

    const dashboard = await rpc<Record<string, any>>(client, 'owner_get_dashboard', { p_event_slug: EVENT_SLUG });
    const enabled = (dashboard.carriages ?? []).filter((wagon: any) => wagon.enabled);
    const sizes = enabled.map((wagon: any) => (dashboard.guests ?? []).filter((guest: any) => guest.carriage?.id === wagon.id).length);
    expect(enabled).toHaveLength(expectedWagons);
    expect(sizes.reduce((sum: number, value: number) => sum + value, 0)).toBe(guestCount);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);

    const prepared = await rpc<Record<string, any>>(client, 'owner_prepare_bunker_v2_test', {
      p_event_id: id,
      p_command_id: commandId(),
    });
    expect(prepared).toMatchObject({
      status: 'prepared', contractVersion: 2, globalGameState: 'LOBBY',
      guestCount, wagonCount: expectedWagons, gameMode: 'test',
    });

    await resetGameAndRegistrations(client, id);
    await client.auth.signOut();
  });
}

test('Bunker V2 rehearsal can traverse the entire story with a persistent device-bound guest dashboard', async () => {
  const owner = await ownerClient();
  const guestClient = publicClient();
  const id = await eventId(owner);
  const deviceKey = `e2e-dashboard-${crypto.randomUUID()}`;
  await resetGameAndRegistrations(owner, id);

  // Nineteen synthetic guests establish the 3-wagon rehearsal layout. The twentieth
  // guest is registered through the public contract so the dashboard has a real device identity.
  await rpc(owner, 'owner_bunker_v2_seed_test_guests', { p_event_id: id, p_count: 19 });
  const deviceGuest = await registerDeviceGuest(guestClient, deviceKey);
  const wagonNumber = Number(deviceGuest.carriage?.number);
  expect(wagonNumber).toBeGreaterThanOrEqual(1);
  expect(wagonNumber).toBeLessThanOrEqual(3);

  const prepared = await rpc<Record<string, any>>(owner, 'owner_prepare_bunker_v2_test', {
    p_event_id: id,
    p_command_id: commandId(),
  });
  expect(prepared).toMatchObject({ guestCount: 20, wagonCount: 3, gameMode: 'test' });

  await transition(owner, id, 'CHARACTERS_READY');
  await transition(owner, id, 'MISSION_01');
  expect(await simulate(owner, id)).toMatchObject({ status: 'simulated', state: 'MISSION_01' });
  await transition(owner, id, 'BREAK');

  await transition(owner, id, 'MISSION_02');
  expect(await simulate(owner, id)).toMatchObject({ status: 'simulated', state: 'MISSION_02' });

  await transition(owner, id, 'MISSION_03');
  await rpc(owner, 'owner_bunker_v2_test_set_inventory', {
    p_event_id: id,
    p_wagon_number: wagonNumber,
    p_item_key: 'water',
    p_quantity: 2,
  });
  await rpc(owner, 'owner_bunker_v2_test_set_wagon_state', {
    p_event_id: id,
    p_wagon_number: wagonNumber,
    p_power: 'stable',
    p_communication: 'degraded',
    p_navigation: 'working',
  });

  const dashboardDuringM03 = await guestDashboard(guestClient, deviceKey);
  expect(dashboardDuringM03).toMatchObject({
    contractVersion: 2,
    status: 'active',
    wagon: { number: wagonNumber },
    wagonState: { powerStatus: 'stable', communicationStatus: 'degraded', navigationStatus: 'working' },
  });
  expect(dashboardDuringM03.passengers.some((passenger: any) => passenger.guestId === deviceGuest.id)).toBe(true);
  expect(dashboardDuringM03.inventory).toEqual(expect.arrayContaining([
    expect.objectContaining({ itemKey: 'water', available: 2 }),
  ]));

  expect(await simulate(owner, id)).toMatchObject({ status: 'simulated', state: 'MISSION_03' });
  await transition(owner, id, 'MISSION_04');
  expect(await simulate(owner, id)).toMatchObject({ status: 'simulated', state: 'MISSION_04' });
  await transition(owner, id, 'MISSION_05');

  const dashboardDuringM05 = await guestDashboard(guestClient, deviceKey);
  expect(dashboardDuringM05.passengers.some((passenger: any) => passenger.guestId === deviceGuest.id)).toBe(true);
  expect(dashboardDuringM05.inventory).toEqual(expect.arrayContaining([
    expect.objectContaining({ itemKey: 'water', available: 2 }),
  ]));
  expect(dashboardDuringM05.wagonState).toMatchObject({
    powerStatus: 'stable', communicationStatus: 'degraded', navigationStatus: 'working',
  });

  expect(await simulate(owner, id)).toMatchObject({ status: 'simulated', state: 'MISSION_05' });
  await transition(owner, id, 'MISSION_06');
  expect(await simulate(owner, id)).toMatchObject({ status: 'simulated', state: 'MISSION_06' });

  const story = await transition(owner, id, 'UNKNOWN_PASSENGER');
  expect(story.globalGameState).toBe('UNKNOWN_PASSENGER');
  const ownerStory = await rpc<Record<string, any>>(owner, 'get_owner_bunker_v2_unknown_passenger', { p_event_id: id });
  expect(ownerStory).toMatchObject({ status: 'active', dossierId: 'BK-17', sector: '04' });

  const storyDashboard = await guestDashboard(guestClient, deviceKey);
  expect(storyDashboard.archive).toEqual(expect.arrayContaining([
    expect.objectContaining({ artifactKey: 'UNKNOWN-BK17', scope: 'global', decryptionStatus: 'decoded' }),
  ]));

  await transition(owner, id, 'BREAK_BEFORE_FINAL');
  const afterStoryDashboard = await guestDashboard(guestClient, deviceKey);
  expect(afterStoryDashboard.archive).toEqual(expect.arrayContaining([
    expect.objectContaining({ artifactKey: 'UNKNOWN-BK17', scope: 'global', decryptionStatus: 'decoded' }),
  ]));

  const finalTransition = await transition(owner, id, 'FINAL_30');
  expect(finalTransition.globalGameState).toBe('FINAL_30');

  const finalBefore = await rpc<Record<string, any>>(owner, 'get_owner_bunker_v2_final', { p_event_id: id });
  expect(finalBefore).toMatchObject({ contractVersion: 2, status: 'active', total: 5 });

  const simulatedFinal = await simulate(owner, id);
  expect(simulatedFinal).toMatchObject({ status: 'simulated', state: 'FINAL_30', opened: true });

  const finalAfter = await rpc<Record<string, any>>(owner, 'get_owner_bunker_v2_final', { p_event_id: id });
  expect(finalAfter.unlocked).toBe(true);

  const testState = await rpc<Record<string, any>>(owner, 'get_owner_bunker_v2_test_state', { p_event_id: id });
  expect(testState.globalState).toBe('BUNKER_OPEN');

  const results = await rpc<Record<string, any>>(owner, 'get_bunker_v2_results', { p_event_slug: EVENT_SLUG });
  expect(results).toMatchObject({
    contractVersion: 2,
    status: 'completed',
    emergencyOpen: true,
    missionsCompleted: expect.any(Number),
    missionsTotal: expect.any(Number),
    coordinationScore: expect.any(Number),
  });
  expect(results.missionsCompleted).toBe(results.missionsTotal);
  expect(results.coordinationScore).toBeGreaterThanOrEqual(0);
  expect(results.coordinationScore).toBeLessThanOrEqual(100);

  await resetGameAndRegistrations(owner, id);
  await owner.auth.signOut();
});
