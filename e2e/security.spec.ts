import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';

function anonymousClient() {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ownerClient() {
  const owner = anonymousClient();
  const { error } = await owner.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (error) throw error;
  return owner;
}

async function eventId(): Promise<string> {
  const owner = await ownerClient();
  const { data, error } = await owner.rpc('owner_get_dashboard', {
    p_event_slug: 'liza-viktor',
  });
  if (error) throw error;

  await owner.auth.signOut();

  if (
    typeof data !== 'object'
    || data === null
    || !('event' in data)
    || typeof data.event !== 'object'
    || data.event === null
    || !('id' in data.event)
  ) {
    throw new Error('Security E2E event id is missing');
  }

  return String(data.event.id);
}

async function resetRuntime() {
  const owner = await ownerClient();
  const { data, error: dashboardError } = await owner.rpc('owner_get_dashboard', {
    p_event_slug: 'liza-viktor',
  });
  if (dashboardError) throw dashboardError;
  if (
    typeof data !== 'object'
    || data === null
    || !('event' in data)
    || typeof data.event !== 'object'
    || data.event === null
    || !('id' in data.event)
  ) {
    throw new Error('Security E2E dashboard is missing event id');
  }

  const { error } = await owner.rpc('owner_reset_event_test_data', {
    p_event_id: String(data.event.id),
    p_confirmation: 'СБРОСИТЬ',
  });
  if (error) throw error;
  await owner.auth.signOut();
}

test('anonymous client cannot invoke owner mutations or enumerate private event data', async () => {
  const anon = anonymousClient();
  const id = await eventId();

  const { error: resetError } = await anon.rpc('owner_reset_event_test_data', {
    p_event_id: id,
    p_confirmation: 'СБРОСИТЬ',
  });
  expect(resetError).toBeTruthy();

  const { error: bunkerError } = await anon.rpc('owner_start_bunker', {
    p_event_id: id,
    p_duration_seconds: 1800,
  });
  expect(bunkerError).toBeTruthy();

  const { error: mkError } = await anon.rpc('owner_open_mk_registration', {
    p_event_id: id,
  });
  expect(mkError).toBeTruthy();

  const { data: guests, error: guestError } = await anon.from('guests').select('*');
  expect(guestError === null ? guests : []).toEqual([]);

  const { data: coupleAnswers, error: coupleError } = await anon.from('couple_preanswers').select('*');
  expect(coupleError === null ? coupleAnswers : []).toEqual([]);
});

test('/admin stays behind owner login and /screen exposes no owner mutation controls', async ({ browser }) => {
  await resetRuntime();

  const anonymousContext = await browser.newContext();
  const page = await anonymousContext.newPage();

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'ВХОД В АДМИНКУ' })).toBeVisible();
  await expect(page.getByText(/список гостей/i)).toHaveCount(0);

  await page.goto('/screen');
  await expect(page.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeVisible();
  await expect(page.getByRole('button', { name: /сбросить тестовые данные/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /запустить турнир/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /начать премьеру/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /экстренное сообщение|бункер/i })).toHaveCount(0);

  await anonymousContext.close();
});

