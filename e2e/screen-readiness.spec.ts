import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';
const EVENT_SLUG = 'liza-viktor';

async function ownerClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('E2E Supabase environment is missing');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  if (error) throw error;
  return client;
}

async function callOwnerRpc(
  client: Awaited<ReturnType<typeof ownerClient>>,
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

async function eventId(client: Awaited<ReturnType<typeof ownerClient>>): Promise<string> {
  const data = await callOwnerRpc(client, 'owner_get_dashboard', {
    p_event_slug: EVENT_SLUG,
  });
  const id = (data as { event?: { id?: unknown } } | null)?.event?.id;
  if (typeof id !== 'string') throw new Error('E2E event id is missing');
  return id;
}

async function loginOwner(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email владельца').fill(OWNER_EMAIL);
  await page.getByLabel('Пароль').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'ВОЙТИ В АДМИНКУ' }).click();
  await expect(page.getByRole('heading', { name: 'Лиза × Виктор' })).toBeVisible();
}

test('an open projector appears as advisory telemetry and exposes compact audio control', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const screenContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const projector = await screenContext.newPage();

  await loginOwner(owner);
  await projector.goto('/screen');
  await expect(projector.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeVisible();
  await expect(projector.getByRole('button', { name: 'Выключить звук' })).toBeVisible();
  await expect(projector.getByRole('slider', { name: 'Громкость' })).toHaveValue('75');

  await expect(owner.getByText('ТВ · 1', { exact: true })).toBeVisible({ timeout: 12_000 });
  await expect(owner.getByText('ИНДИКАЦИЯ · НЕ БЛОКИРУЕТ', { exact: true })).toBeVisible();

  await ownerContext.close();
  await screenContext.close();
});

test('an authoritative quiz question renders a decoded project-local image on the projector', async ({ browser }) => {
  const owner = await ownerClient();
  const id = await eventId(owner);
  await callOwnerRpc(owner, 'owner_reset_event_test_data', {
    p_event_id: id,
    p_confirmation: 'СБРОСИТЬ',
  });
  await callOwnerRpc(owner, 'owner_seed_default_quiz_questions', { p_event_id: id });

  const control = await callOwnerRpc(owner, 'owner_get_quiz_control', { p_event_id: id });
  const questions = (control as { questions?: unknown[] } | null)?.questions;
  if (!Array.isArray(questions)) throw new Error('Quiz questions are missing from owner control');
  const illustrated = questions.find((entry) => (
    typeof entry === 'object'
    && entry !== null
    && 'questionType' in entry
    && entry.questionType === 'standard'
    && 'imagePath' in entry
    && typeof entry.imagePath === 'string'
    && entry.imagePath.startsWith('/images/quiz/')
    && 'id' in entry
    && typeof entry.id === 'string'
  )) as { id: string; imagePath: string } | undefined;
  if (!illustrated) throw new Error('No illustrated standard quiz question is available');

  await callOwnerRpc(owner, 'owner_activate_quiz_question', {
    p_event_id: id,
    p_question_id: illustrated.id,
  });

  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const projector = await context.newPage();
  try {
    await projector.goto('/screen');
    const image = projector.locator('.quiz-screen-question-image');
    await expect(image).toBeVisible({ timeout: 15_000 });
    await expect(image).toHaveAttribute('src', illustrated.imagePath);
    await expect.poll(
      () => image.evaluate((element: HTMLImageElement) => ({
        complete: element.complete,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
      })),
      { timeout: 15_000 },
    ).toMatchObject({ complete: true });
    const decoded = await image.evaluate((element: HTMLImageElement) => ({
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
    }));
    expect(decoded.naturalWidth).toBeGreaterThan(0);
    expect(decoded.naturalHeight).toBeGreaterThan(0);
  } finally {
    await context.close();
    await callOwnerRpc(owner, 'owner_return_quiz_to_main_screen', { p_event_id: id });
    await owner.auth.signOut();
  }
});

