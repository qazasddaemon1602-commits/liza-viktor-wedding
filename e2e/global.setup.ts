import { createClient } from '@supabase/supabase-js';
import { assertSafeE2ESupabaseTarget } from './environmentGuard';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';
const EVENT_SLUG = 'liza-viktor';

function rpcCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) return '';
  return String((error as { code?: unknown }).code ?? '');
}

export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.E2E_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('E2E Supabase environment is missing');
  }

  assertSafeE2ESupabaseTarget(url);

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: listed, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;

  let owner = listed.users.find((user) => user.email === OWNER_EMAIL) ?? null;
  if (!owner) {
    const { data, error } = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    owner = data.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(owner.id, {
      password: OWNER_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
  }

  const ownerClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await ownerClient.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (signInError) throw signInError;

  const { error: createEventError } = await ownerClient.rpc('owner_create_event', {
    p_slug: EVENT_SLUG,
    p_name: 'Лиза × Виктор',
  });

  if (createEventError) {
    if (rpcCode(createEventError) !== '23505') throw createEventError;

    const { data: dashboard, error: dashboardError } = await ownerClient.rpc('owner_get_dashboard', {
      p_event_slug: EVENT_SLUG,
    });
    if (dashboardError) throw dashboardError;

    const eventId = typeof dashboard === 'object'
      && dashboard !== null
      && 'event' in dashboard
      && typeof dashboard.event === 'object'
      && dashboard.event !== null
      && 'id' in dashboard.event
      ? String(dashboard.event.id)
      : '';

    if (!eventId) throw new Error('Existing E2E event id is missing');

    const { error: resetError } = await ownerClient.rpc('owner_reset_event_test_data', {
      p_event_id: eventId,
      p_confirmation: 'СБРОСИТЬ',
    });
    if (resetError) throw resetError;
  }

  await ownerClient.auth.signOut();
}

