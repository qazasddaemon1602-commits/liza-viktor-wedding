import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';
const EVENT_SLUG = 'liza-viktor';

async function ownerClient() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.VITE_SUPABASE_ANON_KEY!;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  if (error) throw error;
  return client;
}

async function resetRuntime() {
  const client = await ownerClient();
  const { data, error: dashboardError } = await client.rpc('owner_get_dashboard', {
    p_event_slug: EVENT_SLUG,
  });
  if (dashboardError) throw dashboardError;
  const event = (data as { event?: { id?: string } } | null)?.event;
  if (!event?.id) throw new Error('Missing event in E2E dashboard');
  const { error } = await client.rpc('owner_reset_event_test_data', {
    p_event_id: event.id,
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

async function registerGuest(page: Page) {
  await page.goto('/join');
  await page.getByLabel('Имя').fill('Quiz');
  await page.getByLabel('Фамилия').fill('Guest');
  await page.getByLabel('С кем вы сегодня?').selectOption('common');
  await page.getByRole('button', { name: 'ПОЛУЧИТЬ БИЛЕТ' }).click();
  await expect(page.getByRole('heading', { name: 'ВАШ ВЕЧЕР' })).toBeVisible();
  await expect(page.getByText('Quiz Guest')).toBeVisible();
}

test.beforeEach(async () => {
  await resetRuntime();
});

test('open guest hub receives live quiz, vote, results and closed-round history', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const guest = await guestContext.newPage();

  await registerGuest(guest);
  await loginOwner(owner);

  const seed = owner.getByRole('button', { name: 'ДОБАВИТЬ 30 ВОПРОСОВ' });
  if (await seed.count()) {
    await seed.click();
  }

  const launch = owner.getByRole('button', { name: /^ЗАПУСТИТЬ:/ }).first();
  await expect(launch).toBeVisible();
  const launchName = await launch.getAttribute('aria-label');
  const questionText = launchName?.replace(/^ЗАПУСТИТЬ:\s*/, '') ?? '';
  if (!questionText) throw new Error('Unable to resolve live quiz question text');
  await launch.click();

  await expect(guest.getByRole('heading', { name: questionText })).toBeVisible({ timeout: 10_000 });
  await expect(guest.locator('.quiz-phase-timer')).toBeVisible();
  await guest.getByRole('button', { name: 'ЛИЗА' }).click();
  await expect(guest.getByText('ОТВЕТ ПРИНЯТ')).toBeVisible();

  await owner.getByRole('button', { name: 'ЗАКРЫТЬ ОТВЕТЫ СЕЙЧАС' }).click();
  await expect(guest.getByText('100%')).toBeVisible({ timeout: 10_000 });

  await owner.getByRole('button', { name: 'ЗАКРЫТЬ ВОПРОС' }).click();
  await expect(guest.getByText('ОЖИДАЕМ СЛЕДУЮЩЕЕ СОБЫТИЕ')).toBeVisible({ timeout: 10_000 });
  await expect(guest.getByLabel('История вечера').getByText(questionText)).toBeVisible();
  await expect(owner.getByLabel('Пройденные вопросы').getByText(questionText)).toBeVisible();

  await ownerContext.close();
  await guestContext.close();
});
