import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';
const EVENT_SLUG = 'liza-viktor';

type OwnerClient = Awaited<ReturnType<typeof ownerClient>>;

async function ownerClient() {
  const client = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  if (error) throw error;
  return client;
}

async function eventId(client: OwnerClient): Promise<string> {
  const { data, error } = await client.rpc('owner_get_dashboard', { p_event_slug: EVENT_SLUG });
  if (error) throw error;
  if (typeof data !== 'object' || data === null || !('event' in data)) {
    throw new Error('Unexpected owner dashboard in MK rehearsal');
  }
  const event = (data as { event?: { id?: unknown } }).event;
  if (!event || typeof event.id !== 'string') throw new Error('MK rehearsal event is missing');
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

async function registerAndJoin(page: Page, firstName: string, lastName: string) {
  await page.goto('/join');
  await page.getByLabel('Имя').fill(firstName);
  await page.getByLabel('Фамилия').fill(lastName);
  await page.getByLabel('С кем вы сегодня?').selectOption('common');
  await page.getByLabel('Уточнение').fill('MK E2E rehearsal');
  await page.getByRole('button', { name: 'ПОЛУЧИТЬ БИЛЕТ' }).click();
  await expect(page.getByText(`${firstName} ${lastName}`)).toBeVisible();

  await page.goto('/mortal-kombat');
  await page.getByRole('button', { name: 'УЧАСТВОВАТЬ В БИТВЕ' }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport + 1);
}

async function expectOpeningRoundFits(
  browser: Browser,
  path: '/screen' | '/mortal-kombat/screen',
  viewport: { width: number; height: number },
) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(path);
  const bracket = page.getByTestId('mk-projector-bracket');
  await expect(bracket).toBeVisible();
  await expect(bracket.locator('.mk-bracket-match')).toHaveCount(8);

  const metrics = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
  }));
  expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  await context.close();
}

test.beforeEach(async () => {
  await resetRuntime();
});

test('limits eighteen long-name joins to sixteen fighters, renders all opening bouts, and stays viewport-safe', async ({ browser }) => {
  const client = await ownerClient();
  const id = await eventId(client);
  const { error: openError } = await client.rpc('owner_open_mk_registration', { p_event_id: id });
  if (openError) throw openError;

  const contexts: Awaited<ReturnType<Browser['newContext']>>[] = [];
  for (let index = 1; index <= 18; index += 1) {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    await registerAndJoin(page, `Александра${index}`, `Длиннофамильева${index}`);
    if (index <= 16) {
      await expect(page.getByText(`ВЫ В ТУРНИРЕ · ${index} / 16`)).toBeVisible();
    } else {
      await expect(page.getByText(`ЛИСТ ОЖИДАНИЯ · №${index - 16}`)).toBeVisible();
    }
  }

  const { data: control, error: controlError } = await client.rpc('owner_get_mk_control', { p_event_id: id });
  if (controlError) throw controlError;
  expect(control).toMatchObject({ activeCount: 16, waitlistCount: 2, maxPlayers: 16 });

  for (const command of ['owner_close_mk_registration', 'owner_randomize_mk_seeds', 'owner_finalize_mk_draw'] as const) {
    const { error } = await client.rpc(command, { p_event_id: id });
    if (error) throw error;
  }
  for (const command of ['owner_show_mk_bracket', 'owner_set_mk_main_screen'] as const) {
    const { error } = await client.rpc(command, command === 'owner_set_mk_main_screen'
      ? { p_event_id: id, p_enabled: true }
      : { p_event_id: id });
    if (error) throw error;
  }

  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    await expectOpeningRoundFits(browser, '/screen', viewport);
    await expectOpeningRoundFits(browser, '/mortal-kombat/screen', viewport);
  }

  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto('/mortal-kombat');
    await expect(page.locator('.mk-page')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await context.close();
  }

  await Promise.all(contexts.map((context) => context.close()));
  await client.auth.signOut();
});
