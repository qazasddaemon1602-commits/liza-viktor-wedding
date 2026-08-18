import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

function clients() {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.E2E_SERVICE_ROLE_KEY!;
  return {
    anon: createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    admin: createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

test('anonymous client cannot invoke owner mutations or enumerate private event data', async () => {
  const { anon, admin } = clients();
  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id')
    .eq('slug', 'liza-viktor')
    .single();
  if (eventError) throw eventError;

  const { error: resetError } = await anon.rpc('owner_reset_event_test_data', {
    p_event_id: event.id,
    p_confirmation: 'СБРОСИТЬ',
  });
  expect(resetError).toBeTruthy();

  const { error: bunkerError } = await anon.rpc('owner_start_bunker', {
    p_event_id: event.id,
    p_duration_seconds: 1800,
  });
  expect(bunkerError).toBeTruthy();

  const { error: mkError } = await anon.rpc('owner_open_mk_registration', {
    p_event_id: event.id,
  });
  expect(mkError).toBeTruthy();

  const { data: guests, error: guestError } = await anon.from('guests').select('*');
  expect(guestError === null ? guests : []).toEqual([]);

  const { data: coupleAnswers, error: coupleError } = await anon.from('couple_preanswers').select('*');
  expect(coupleError === null ? coupleAnswers : []).toEqual([]);
});

test('/admin stays behind owner login and /screen exposes no owner mutation controls', async ({ browser }) => {
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
