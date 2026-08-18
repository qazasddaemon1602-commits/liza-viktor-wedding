import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';
const EVENT_SLUG = 'liza-viktor';

type DashboardGuest = {
  id: string;
  firstName: string;
  lastName: string;
  ticketNumber: string;
  carriage: { id: string };
};

type OwnerDashboardState = {
  event: { id: string };
  guests: DashboardGuest[];
};

async function ownerClient() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.VITE_SUPABASE_ANON_KEY!;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  if (error) throw error;
  return client;
}

async function ownerDashboard(
  client: Awaited<ReturnType<typeof ownerClient>>,
): Promise<OwnerDashboardState> {
  const { data, error } = await client.rpc('owner_get_dashboard', {
    p_event_slug: EVENT_SLUG,
  });
  if (error) throw error;
  if (
    typeof data !== 'object'
    || data === null
    || !('event' in data)
    || !('guests' in data)
  ) {
    throw new Error('Unexpected owner dashboard in E2E');
  }
  return data as unknown as OwnerDashboardState;
}

async function eventId(client: Awaited<ReturnType<typeof ownerClient>>): Promise<string> {
  return (await ownerDashboard(client)).event.id;
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

function timerSeconds(label: string | null): number {
  if (!label || !/^\d{2}:\d{2}$/.test(label)) throw new Error(`Unexpected timer label: ${label}`);
  const [minutes, seconds] = label.split(':').map(Number);
  return minutes * 60 + seconds;
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

test('late guest after premiere gets a normal ticket without changing earlier carriage assignment', async ({ browser }) => {
  const firstContext = await browser.newContext();
  const lateContext = await browser.newContext();
  const screenContext = await browser.newContext();
  const firstGuest = await firstContext.newPage();
  const lateGuest = await lateContext.newPage();
  const projector = await screenContext.newPage();

  await registerGuest(firstGuest, 'До', 'Премьеры');

  const client = await ownerClient();
  const id = await eventId(client);
  const firstBefore = (await ownerDashboard(client)).guests.find(
    (guest) => guest.firstName === 'До' && guest.lastName === 'Премьеры',
  );
  if (!firstBefore) throw new Error('First guest is missing before premiere');

  const { error: mediaError } = await client.rpc('owner_set_premiere_media', {
    p_event_id: id,
    p_media_url: 'https://example.invalid/e2e-late-after-premiere.mp4',
    p_duration_seconds: 30,
  });
  if (mediaError) throw mediaError;
  const { error: startError } = await client.rpc('owner_start_premiere', {
    p_event_id: id,
    p_countdown_seconds: 1,
  });
  if (startError) throw startError;

  await projector.goto('/screen');
  await expect(projector.getByText(/ПРЕМЬЕРА|1/)).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 1_250));

  const { error: returnError } = await client.rpc('owner_return_main_screen', { p_event_id: id });
  if (returnError) throw returnError;
  await projector.reload();
  await expect(projector.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeVisible();

  await registerGuest(lateGuest, 'После', 'Премьеры');

  const afterDashboard = await ownerDashboard(client);
  const firstAfter = afterDashboard.guests.find((guest) => guest.id === firstBefore.id);
  if (!firstAfter) throw new Error('First guest is missing after premiere');
  expect(firstAfter.carriage.id).toBe(firstBefore.carriage.id);
  expect(firstAfter.ticketNumber).toBe(firstBefore.ticketNumber);

  const lateRow = afterDashboard.guests.find(
    (guest) => guest.firstName === 'После' && guest.lastName === 'Премьеры',
  );
  if (!lateRow) throw new Error('Late guest is missing after premiere');
  expect(lateRow.ticketNumber).toBe('LV-002');

  await client.auth.signOut();
  await firstContext.close();
  await lateContext.close();
  await screenContext.close();
});

test('bunker takes over two projectors, stays synchronized, and drops ordinary events', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const screenAContext = await browser.newContext();
  const screenBContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const screenA = await screenAContext.newPage();
  const screenB = await screenBContext.newPage();
  const guest = await guestContext.newPage();

  await loginOwner(owner);
  await Promise.all([screenA.goto('/screen'), screenB.goto('/screen')]);
  await expect(screenA.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeVisible();
  await expect(screenB.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeVisible();

  await expect(owner.getByRole('heading', { name: 'БУНКЕР' })).toBeVisible({ timeout: 10_000 });
  await owner.getByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }).click();
  await owner.getByRole('button', { name: /ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ/ }).click();

  await expect(screenA.getByTestId('bunker-emergency-scene')).toBeVisible();
  await expect(screenB.getByTestId('bunker-emergency-scene')).toBeVisible();
  await expect(screenA.getByText('ЭКСТРЕННОЕ СООБЩЕНИЕ')).toBeVisible();
  await expect(screenB.getByText('ЭКСТРЕННОЕ СООБЩЕНИЕ')).toBeVisible();

  const timerA = timerSeconds(await screenA.getByTestId('bunker-timer').textContent());
  const timerB = timerSeconds(await screenB.getByTestId('bunker-timer').textContent());
  expect(Math.abs(timerA - timerB)).toBeLessThanOrEqual(1);
  expect(timerA).toBeGreaterThanOrEqual(1795);

  await registerGuest(guest, 'Во Время', 'Бункера');
  await expect(screenA.getByTestId('train-arrival-scene')).toHaveCount(0);
  await expect(screenB.getByTestId('train-arrival-scene')).toHaveCount(0);

  await owner.getByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' }).click();
  await expect(screenA.getByTestId('bunker-emergency-scene')).toHaveCount(0);
  await expect(screenB.getByTestId('bunker-emergency-scene')).toHaveCount(0);
  await expect(screenA.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeVisible();
  await expect(screenB.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeVisible();
  await expect(screenA.getByText('Во Время Бункера')).toHaveCount(0);
  await expect(screenB.getByText('Во Время Бункера')).toHaveCount(0);

  await ownerContext.close();
  await screenAContext.close();
  await screenBContext.close();
  await guestContext.close();
});

test('bunker unmounts an active premiere and restores authoritative premiere state after stop', async ({ browser }) => {
  const client = await ownerClient();
  const id = await eventId(client);
  const { error: mediaError } = await client.rpc('owner_set_premiere_media', {
    p_event_id: id,
    p_media_url: 'https://example.invalid/e2e-bunker-takeover.mp4',
    p_duration_seconds: 120,
  });
  if (mediaError) throw mediaError;
  const { error: startError } = await client.rpc('owner_start_premiere', {
    p_event_id: id,
    p_countdown_seconds: 1,
  });
  if (startError) throw startError;

  await new Promise((resolve) => setTimeout(resolve, 1_250));

  const ownerContext = await browser.newContext();
  const screenContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const projector = await screenContext.newPage();

  await loginOwner(owner);
  await projector.goto('/screen');
  await expect(projector.locator('video.premiere-player')).toHaveCount(1);

  await expect(owner.getByRole('heading', { name: 'БУНКЕР' })).toBeVisible({ timeout: 10_000 });
  await owner.getByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }).click();
  await owner.getByRole('button', { name: /ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ/ }).click();

  await expect(projector.getByTestId('bunker-emergency-scene')).toBeVisible();
  await expect(projector.locator('video.premiere-player')).toHaveCount(0);

  await owner.getByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' }).click();
  await expect(projector.getByTestId('bunker-emergency-scene')).toHaveCount(0);
  await expect(projector.locator('video.premiere-player')).toHaveCount(1, { timeout: 10_000 });

  await client.auth.signOut();
  await ownerContext.close();
  await screenContext.close();
});
