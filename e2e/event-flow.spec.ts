import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';

async function ownerClient() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.VITE_SUPABASE_ANON_KEY!;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  if (error) throw error;
  return client;
}

async function eventId(client: Awaited<ReturnType<typeof ownerClient>>): Promise<string> {
  const { data: event, error } = await client
    .from('events')
    .select('id')
    .eq('slug', 'liza-viktor')
    .single();
  if (error) throw error;
  return event.id;
}

async function resetRuntime() {
  const client = await ownerClient();
  const id = await eventId(client);
  const { error } = await client.rpc('owner_reset_event_test_data', {
    p_event_id: id,
    p_confirmation: 'СБРОСИТЬ',
  });
  if (error) throw error;
  await client.auth.signOut();
}

async function loginOwner(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email владельца').fill(OWNER_EMAIL);
  await page.getByLabel('Пароль').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'ВОЙТИ В АДМИНКУ' }).click();
  await expect(page.getByRole('heading', { name: 'Лиза × Виктор' })).toBeVisible();
}

async function registerGuest(page: Page, firstName: string, lastName: string) {
  await page.goto('/join');
  await expect(page.getByRole('button', { name: 'ПОЛУЧИТЬ БИЛЕТ' })).toBeVisible();
  await page.getByLabel('Имя').fill(firstName);
  await page.getByLabel('Фамилия').fill(lastName);
  await page.getByLabel('С кем вы сегодня?').selectOption('common');
  await page.getByLabel('Уточнение').fill('E2E test');
  await page.getByRole('button', { name: 'ПОЛУЧИТЬ БИЛЕТ' }).click();
  await expect(page.getByText(`${firstName} ${lastName}`)).toBeVisible();
  await expect(page.getByText(/LV-\d{3}/)).toBeVisible();
}

test.beforeEach(async () => {
  await resetRuntime();
});

test('guest registration updates owner and queues the train moment on an idle projector', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const screenContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const projector = await screenContext.newPage();
  const guest = await guestContext.newPage();

  await loginOwner(owner);
  await projector.goto('/screen');
  await expect(projector.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeVisible();

  await registerGuest(guest, 'Анна', 'Смирнова');

  await expect(owner.getByText('Анна Смирнова')).toBeVisible();
  await expect(projector.getByTestId('train-arrival-scene')).toBeVisible();
  await expect(projector.getByText('Анна Смирнова')).toBeVisible();

  await ownerContext.close();
  await screenContext.close();
  await guestContext.close();
});

test('composition lock keeps registration open for a late guest', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const firstGuestContext = await browser.newContext();
  const lateGuestContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const firstGuest = await firstGuestContext.newPage();
  const lateGuest = await lateGuestContext.newPage();

  await registerGuest(firstGuest, 'Первый', 'Гость');
  await loginOwner(owner);
  await owner.getByRole('button', { name: 'ЗАФИКСИРОВАТЬ СОСТАВ' }).click();
  await expect(owner.getByText('СОСТАВ ЗАФИКСИРОВАН')).toBeVisible();
  await expect(owner.getByText('РЕГИСТРАЦИЯ ОТКРЫТА')).toBeVisible();

  await registerGuest(lateGuest, 'Поздний', 'Гость');

  await expect(owner.getByText('Поздний Гость')).toBeVisible();
  await expect(lateGuest.getByText('Поздний Гость')).toBeVisible();

  await ownerContext.close();
  await firstGuestContext.close();
  await lateGuestContext.close();
});

test('registration during premiere countdown never interrupts the protected projector scene', async ({ browser }) => {
  const client = await ownerClient();
  const id = await eventId(client);
  const { error: mediaError } = await client.rpc('owner_set_premiere_media', {
    p_event_id: id,
    p_media_url: 'https://example.invalid/e2e-premiere.mp4',
    p_duration_seconds: 30,
  });
  if (mediaError) throw mediaError;
  const { error: startError } = await client.rpc('owner_start_premiere', {
    p_event_id: id,
    p_countdown_seconds: 10,
  });
  if (startError) throw startError;

  const screenContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const projector = await screenContext.newPage();
  const guest = await guestContext.newPage();

  await projector.goto('/screen');
  await expect(projector.getByText(/ПРЕМЬЕРА|10|9|8/)).toBeVisible();

  await registerGuest(guest, 'Во Время', 'Премьеры');
  await expect(projector.getByText('Во Время Премьеры')).toHaveCount(0);
  await expect(projector.getByTestId('train-arrival-scene')).toHaveCount(0);

  const { error: returnError } = await client.rpc('owner_return_main_screen', { p_event_id: id });
  if (returnError) throw returnError;
  await projector.reload();
  await expect(projector.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeVisible();

  await client.auth.signOut();
  await screenContext.close();
  await guestContext.close();
});
