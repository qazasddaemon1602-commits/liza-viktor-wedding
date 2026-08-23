import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';
const EVENT_SLUG = 'liza-viktor';
const DEVICE_STORAGE_KEY = 'lvw:device-key';
const FORCE_OPEN_CONFIRMATION = 'ОТКРЫТЬ БУНКЕР ПРИНУДИТЕЛЬНО';

const PHONE_VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
] as const;

const PROJECTOR_VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
] as const;

const PROJECTOR_MISSION_TITLES = {
  M01: 'Лишний пассажир',
  M03: 'Аварийный запас',
  M04: 'Межвагонная связь',
  M06: 'Общий протокол',
  FINAL: 'Бункер 30:00',
} as const;

type BunkerMissionState =
  | 'MISSION_01'
  | 'MISSION_02'
  | 'MISSION_03'
  | 'MISSION_04'
  | 'MISSION_05'
  | 'MISSION_06';

type Dashboard = {
  event: { id: string };
  carriages: Array<{ id: string; enabled: boolean }>;
};

type BunkerFixture = {
  owner: SupabaseClient;
  eventId: string;
  carriageIds: string[];
  guestDeviceKey: string;
};

async function ownerClient(): Promise<SupabaseClient> {
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

async function rpc(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

async function dashboard(client: SupabaseClient): Promise<Dashboard> {
  const data = await rpc(client, 'owner_get_dashboard', { p_event_slug: EVENT_SLUG });
  if (
    typeof data !== 'object'
    || data === null
    || !('event' in data)
    || !('carriages' in data)
  ) {
    throw new Error('Unexpected owner dashboard in Bunker responsive E2E');
  }
  return data as unknown as Dashboard;
}

async function resetRuntime(client: SupabaseClient, eventId: string) {
  await rpc(client, 'owner_reset_event_test_data', {
    p_event_id: eventId,
    p_confirmation: 'СБРОСИТЬ',
  });
}

async function prepareAuthoritativeBunker(): Promise<BunkerFixture> {
  const owner = await ownerClient();
  const initial = await dashboard(owner);
  await resetRuntime(owner, initial.event.id);

  const deviceKeys = Array.from({ length: 4 }, (_, index) => (
    `lvw_bunker_responsive_${index + 1}`
  ));
  for (const [index, deviceKey] of deviceKeys.entries()) {
    await rpc(owner, 'register_guest', {
      p_event_slug: EVENT_SLUG,
      p_device_key: deviceKey,
      p_first_name: `Тест ${index + 1}`,
      p_last_name: 'Бункер',
      p_affiliation_type: 'common',
      p_affiliation_detail: 'Responsive E2E',
      p_confirm_duplicate: false,
    });
  }

  await rpc(owner, 'owner_apply_carriage_distribution', {
    p_event_id: initial.event.id,
    p_carriage_count: 2,
  });
  const distributed = await dashboard(owner);
  const carriageIds = distributed.carriages
    .filter((carriage) => carriage.enabled)
    .map((carriage) => carriage.id);
  expect(carriageIds).toHaveLength(2);

  await rpc(owner, 'owner_prepare_bunker_game', {
    p_event_id: initial.event.id,
    p_game_mode: 'production',
  });
  await rpc(owner, 'owner_distribute_bunker_characters', {
    p_event_id: initial.event.id,
  });
  await rpc(owner, 'owner_start_bunker', {
    p_event_id: initial.event.id,
    p_duration_seconds: 1800,
  });
  await rpc(owner, 'owner_advance_bunker_game_state', {
    p_event_id: initial.event.id,
    p_next_state: 'MISSION_01',
  });

  return {
    owner,
    eventId: initial.event.id,
    carriageIds,
    guestDeviceKey: deviceKeys[0],
  };
}

async function completeMission(fixture: BunkerFixture, missionState: BunkerMissionState) {
  for (const carriageId of fixture.carriageIds) {
    await rpc(fixture.owner, 'owner_force_complete_bunker_global_mission', {
      p_event_id: fixture.eventId,
      p_carriage_id: carriageId,
      p_mission_state: missionState,
    });
  }
}

async function advance(fixture: BunkerFixture, nextState: string) {
  await rpc(fixture.owner, 'owner_advance_bunker_game_state', {
    p_event_id: fixture.eventId,
    p_next_state: nextState,
  });
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

async function expectInsideViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function expectInsideContainer(locator: Locator, container: Locator) {
  const box = await locator.boundingBox();
  const containerBox = await container.boundingBox();
  expect(box).not.toBeNull();
  expect(containerBox).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
  expect(box!.y).toBeGreaterThanOrEqual(containerBox!.y - 1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(containerBox!.x + containerBox!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(containerBox!.y + containerBox!.height + 1);
}

async function expectReadableInViewport(page: Page, locator: Locator, minimumPx = 18) {
  await locator.scrollIntoViewIfNeeded();
  await expectInsideViewport(page, locator);
  const fontSize = await locator.evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(fontSize).toBeGreaterThanOrEqual(minimumPx);
}

async function expectLargeTextNavigation(page: Page) {
  const navigation = page.getByRole('navigation', { name: 'Разделы игры' });
  await expectInsideViewport(page, navigation);
  const visibleButtons = navigation.locator('button:visible');
  await expect(visibleButtons).toHaveCount(5);
  for (const button of await visibleButtons.all()) {
    await expectInsideViewport(page, button);
    const box = await button.boundingBox();
    const fontSize = await button.evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(52);
    expect(fontSize).toBeGreaterThanOrEqual(18);
  }
}

async function expectActionClearOfFixedNavigation(page: Page, action: Locator) {
  await action.scrollIntoViewIfNeeded();
  await expectInsideViewport(page, action);
  const actionBox = await action.boundingBox();
  const navigationBox = await page.getByRole('navigation', { name: 'Разделы игры' }).boundingBox();
  expect(actionBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(navigationBox!.y - 1);
  expect(actionBox!.height).toBeGreaterThanOrEqual(48);
}

async function openGuestPhone(
  browser: Browser,
  viewport: (typeof PHONE_VIEWPORTS)[number],
  deviceKey: string,
) {
  const context = await browser.newContext({
    viewport,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(
    ({ storageKey, value }) => localStorage.setItem(storageKey, value),
    { storageKey: DEVICE_STORAGE_KEY, value: deviceKey },
  );
  const page = await context.newPage();
  await page.goto('/join');
  await expect(page.getByRole('region', { name: 'Игровой модуль Бункер' })).toBeVisible({ timeout: 15_000 });
  return { context, page };
}

async function expectProjectorMission(
  browser: Browser,
  missionKey: 'M01' | 'M03' | 'M04' | 'M06' | 'FINAL',
  options: { unlocked?: boolean } = {},
) {
  for (const viewport of PROJECTOR_VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    try {
      await page.goto('/screen');
      const scene = page.getByRole('region', { name: 'Бункер · экран квеста' });
      await expect(scene).toHaveAttribute('data-mission-key', missionKey, { timeout: 15_000 });
      await expectInsideViewport(page, scene);
      await expectInsideViewport(page, scene.locator('.bunker-quest-scene__header'));
      const body = scene.locator('.bunker-quest-scene__body');
      const story = scene.locator('.bunker-quest-scene__story');
      await expectInsideViewport(page, body);
      await expectInsideViewport(page, story);
      await expect(story.getByRole('heading', { level: 2 })).toHaveText(
        PROJECTOR_MISSION_TITLES[missionKey],
      );
      for (const storyChild of [
        story.getByRole('heading', { level: 2 }),
        story.locator('strong'),
        story.locator('p'),
      ]) {
        await expectInsideViewport(page, storyChild);
        await expectInsideContainer(storyChild, story);
      }

      if (missionKey === 'FINAL') {
        const finalPanel = scene.locator('.bunker-quest-scene__final');
        await expectInsideViewport(page, finalPanel);
        await expectInsideContainer(finalPanel, body);
        await expectInsideViewport(page, finalPanel.locator('.bunker-quest-scene__progress-heading'));
        const slots = finalPanel.locator('.bunker-quest-scene__slots');
        await expectInsideViewport(page, slots);
        for (const card of await slots.locator(':scope > article').all()) {
          await expectInsideViewport(page, card);
          await expectInsideContainer(card, finalPanel);
        }
        if (options.unlocked) {
          const unlock = finalPanel.locator('.bunker-quest-scene__unlock-state');
          await expect(unlock.locator('strong')).toHaveText('ДОСТУП ПОЛУЧЕН');
          await expect(unlock.locator('span')).toHaveText('ОЖИДАЕМ ПРИБЫТИЕ');
          await expectInsideViewport(page, unlock);
          await expectInsideContainer(unlock, finalPanel);
        } else {
          await expect(finalPanel.locator('.bunker-quest-scene__unlock-state')).toHaveCount(0);
        }
      } else {
        const missionPanel = scene.locator('.bunker-quest-scene__mission');
        await expectInsideViewport(page, missionPanel);
        await expectInsideContainer(missionPanel, body);
        await expectInsideViewport(page, missionPanel.locator('.bunker-quest-scene__progress-heading'));
        await expectInsideViewport(page, missionPanel.locator('.bunker-quest-scene__character-counts'));
        const cards = missionPanel.locator('.bunker-quest-scene__teams > article');
        await expect(cards).toHaveCount(2);
        for (const card of await cards.all()) {
          await expectInsideViewport(page, card);
          await expectInsideContainer(card, missionPanel);
        }
      }
      await expectInsideViewport(page, scene.locator('footer'));
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  }
}

test.describe.serial('authoritative Bunker layouts', () => {
  test.describe.configure({ timeout: 120_000 });
  let fixture: BunkerFixture;

  test.beforeAll(async () => {
    fixture = await prepareAuthoritativeBunker();
  });

  test.afterAll(async () => {
    if (!fixture) return;
    await resetRuntime(fixture.owner, fixture.eventId);
    await fixture.owner.auth.signOut();
  });

  test('M01 intro fits both supported projector sizes', async ({ browser }) => {
    await expectProjectorMission(browser, 'M01');
  });

  test('an already-open TV converges after a guest action without an owner transition', async ({ browser }) => {
    const tvContext = await browser.newContext({ viewport: PROJECTOR_VIEWPORTS[0] });
    const tv = await tvContext.newPage();
    const { context: guestContext, page: guest } = await openGuestPhone(
      browser,
      PHONE_VIEWPORTS[1],
      fixture.guestDeviceKey,
    );
    try {
      await tv.goto('/screen');
      const scene = tv.getByRole('region', { name: 'Бункер · экран квеста' });
      await expect(scene).toHaveAttribute('data-mission-key', 'M01', { timeout: 15_000 });
      const progress = scene.locator('.bunker-quest-scene__progress-heading strong');
      await expect(progress).toHaveText('0 / 2 ГОТОВО');

      await guest.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' }).click();
      const submit = guest.getByRole('button', { name: 'ПОДТВЕРДИТЬ ВЫБОР' });
      const candidates = guest.locator('.bunker-global-action--selection input[type="checkbox"]');
      for (let index = 0; index < await candidates.count() && await submit.isDisabled(); index += 1) {
        await candidates.nth(index).check();
      }
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(guest.getByRole('heading', { name: /решение вагона принято/i })).toBeVisible();

      await expect(progress).toHaveText('1 / 2 ГОТОВО', { timeout: 10_000 });
      await expect(scene).toHaveAttribute('data-mission-key', 'M01');
    } finally {
      await guestContext.close();
      await tvContext.close();
    }
  });

  test('M03 stays actionable at 320x720 and 390x844 with large text and compact navigation', async ({ browser }) => {
    await completeMission(fixture, 'MISSION_01');
    await advance(fixture, 'BREAK');
    await advance(fixture, 'MISSION_02');
    await completeMission(fixture, 'MISSION_02');
    await advance(fixture, 'MISSION_03');

    await expectProjectorMission(browser, 'M03');

    for (const viewport of PHONE_VIEWPORTS) {
      const { context, page } = await openGuestPhone(browser, viewport, fixture.guestDeviceKey);
      try {
        const dashboardRoot = page.getByRole('region', { name: 'Игровой модуль Бункер' });
        const openMission = page.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' });
        const largeText = page.getByRole('button', { name: 'КРУПНЫЙ ТЕКСТ' });
        const navigation = page.getByRole('navigation', { name: 'Разделы игры' });

        await expect(openMission).toBeInViewport({ ratio: 0.75 });
        await expectInsideViewport(page, largeText);
        await expectInsideViewport(page, navigation);
        await expect(navigation.getByRole('button')).toHaveCount(5);

        await largeText.click();
        await expect(dashboardRoot).toHaveAttribute('data-large-text', 'true');
        await expectLargeTextNavigation(page);

        const overflow = navigation.getByRole('button', { name: 'ЕЩЁ', exact: true });
        await overflow.click();
        await expect(navigation.getByRole('button', { name: 'ПАССАЖИРЫ' })).toBeVisible();
        await expect(navigation.getByRole('button', { name: 'АРХИВ' })).toBeVisible();
        await navigation.getByRole('button', { name: 'СОСТОЯНИЕ' }).click();
        await expect(page.getByRole('heading', { name: 'СОСТОЯНИЕ ВАГОНА' })).toBeVisible();
        await expect(navigation.getByRole('button', { name: 'ЕЩЁ · СОСТОЯНИЕ' })).toBeFocused();

        await page.reload();
        await expect(dashboardRoot).toHaveAttribute('data-large-text', 'true', { timeout: 15_000 });
        await page.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' }).click();
        const missionCopy = page.locator('.bunker-mission-briefing__header strong');
        await expectReadableInViewport(page, missionCopy);
        const boardCards = page.getByRole('list', { name: 'Риски вагона' }).locator(':scope > li');
        await expect(boardCards).toHaveCount(5);
        for (const card of await boardCards.all()) {
          await card.scrollIntoViewIfNeeded();
          await expectInsideViewport(page, card);
          const status = card.locator(':scope > div > p');
          const title = card.getByRole('heading', { level: 4 });
          const risk = card.locator(':scope > div > span');
          const help = card.locator(':scope > div > strong');
          const control = card.locator('label.bunker-m03-problem-board__control');
          const controlCopy = control.locator(':scope > span');
          const checkbox = control.getByRole('checkbox');
          for (const copy of [status, title, risk, help, controlCopy]) {
            await expectReadableInViewport(page, copy);
            await expectInsideContainer(copy, card);
          }
          await control.scrollIntoViewIfNeeded();
          await expectInsideViewport(page, control);
          await expectInsideContainer(control, card);
          await expectInsideViewport(page, checkbox);
          const checkboxBox = await checkbox.boundingBox();
          expect(checkboxBox).not.toBeNull();
          expect(checkboxBox!.width).toBeGreaterThanOrEqual(22);
          expect(checkboxBox!.height).toBeGreaterThanOrEqual(22);
        }
        const availableRisk = page.getByRole('checkbox', { name: 'Применить: Вода' });
        await expect(availableRisk).toBeVisible();
        await availableRisk.check();
        await expect(page.getByLabel('Предварительный итог').getByText(/Закрыто рисков: 1 из 5/)).toBeVisible();
        const submit = page.getByRole('button', { name: 'ПРИМЕНИТЬ ЗАПАС' });
        await expect(submit).toBeEnabled();
        await expectReadableInViewport(page, submit);
        await expectActionClearOfFixedNavigation(page, submit);
        await expectLargeTextNavigation(page);
        await expectNoHorizontalOverflow(page);
      } finally {
        await context.close();
      }
    }
  });

  test('M03 to M04 replaces the live projector intro and M04 remains usable on both phones', async ({ browser }) => {
    const replayContext = await browser.newContext({ viewport: PROJECTOR_VIEWPORTS[0] });
    try {
      const replayPage = await replayContext.newPage();
      await replayPage.goto('/screen');
      const replayScene = replayPage.getByRole('region', { name: 'Бункер · экран квеста' });
      await expect(replayScene).toHaveAttribute('data-mission-key', 'M03', { timeout: 15_000 });
      const previousScene = await replayScene.elementHandle();

      await completeMission(fixture, 'MISSION_03');
      await advance(fixture, 'MISSION_04');

      await expect(replayScene).toHaveAttribute('data-mission-key', 'M04', { timeout: 15_000 });
      expect(await previousScene!.evaluate((element) => element.isConnected)).toBe(false);
      await expect(replayScene.getByRole('heading', { name: 'Межвагонная связь' })).toBeVisible();
    } finally {
      await replayContext.close();
    }

    await expectProjectorMission(browser, 'M04');

    for (const viewport of PHONE_VIEWPORTS) {
      const { context, page } = await openGuestPhone(browser, viewport, fixture.guestDeviceKey);
      try {
        const dashboardRoot = page.getByRole('region', { name: 'Игровой модуль Бункер' });
        await page.getByRole('button', { name: 'КРУПНЫЙ ТЕКСТ' }).click();
        await expect(dashboardRoot).toHaveAttribute('data-large-text', 'true');
        await page.getByRole('button', { name: 'ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ' }).click();
        await expectReadableInViewport(page, page.locator('.bunker-mission-briefing__header strong'));
        const stepper = page.getByRole('list', { name: 'Порядок межвагонного обмена' });
        const steps = stepper.locator(':scope > li');
        await expect(steps).toHaveCount(4);
        await expect(stepper.getByText('ШАГ 1')).toBeVisible();
        await expect(stepper.getByText('ШАГ 4')).toBeVisible();
        for (const step of await steps.all()) {
          await step.scrollIntoViewIfNeeded();
          await expectInsideViewport(page, step);
          const status = step.locator(':scope > strong');
          const title = step.getByRole('heading', { level: 4 });
          const body = step.locator(':scope > div > p');
          for (const copy of [status, title, body]) {
            await expectReadableInViewport(page, copy);
            await expectInsideContainer(copy, step);
          }
        }

        const exchangeStep = steps.nth(2);
        const submissionStep = steps.nth(3);
        const itemLabel = exchangeStep.getByText('Предмет для передачи', { exact: true });
        const itemSelect = exchangeStep.getByLabel('Предмет для передачи');
        await expectReadableInViewport(page, itemLabel);
        await expectReadableInViewport(page, itemSelect);
        await expectInsideContainer(itemLabel, exchangeStep);
        await expectInsideContainer(itemSelect, exchangeStep);
        await itemSelect.selectOption({ index: 1 });

        const partnerLabel = exchangeStep.getByText('Кому передать предмет', { exact: true });
        const partnerSelect = exchangeStep.getByLabel('Кому передать предмет');
        await expectReadableInViewport(page, partnerLabel);
        await expectReadableInViewport(page, partnerSelect);
        await expectInsideContainer(partnerLabel, exchangeStep);
        await expectInsideContainer(partnerSelect, exchangeStep);
        await partnerSelect.selectOption({ index: 1 });

        const messageLabel = submissionStep.getByText('Сообщение партнёрам', { exact: true });
        const messageInput = submissionStep.getByLabel('Сообщение партнёрам');
        await expectReadableInViewport(page, messageLabel);
        await expectReadableInViewport(page, messageInput);
        await expectInsideContainer(messageLabel, submissionStep);
        await expectInsideContainer(messageInput, submissionStep);
        await messageInput.fill(
          'Сектор 04: тоннель и маршрут проверены, общий канал связи восстановлен.',
        );
        const preview = submissionStep.getByLabel('Предварительная проверка обмена');
        await preview.scrollIntoViewIfNeeded();
        await expectInsideViewport(page, preview);
        await expectInsideContainer(preview, submissionStep);
        await expectReadableInViewport(page, preview.getByRole('heading', { level: 5 }));
        for (const previewLine of await preview.locator('p').all()) {
          await expectReadableInViewport(page, previewLine);
          await expectInsideContainer(previewLine, preview);
        }
        const submit = page.getByRole('button', { name: 'ОТПРАВИТЬ СООБЩЕНИЕ' });
        await expect(submit).toBeEnabled();
        await expectReadableInViewport(page, submit);
        await expectActionClearOfFixedNavigation(page, submit);
        await expectLargeTextNavigation(page);
        await expectNoHorizontalOverflow(page);
      } finally {
        await context.close();
      }
    }
  });

  test('M06 and final retain complete projector compositions at both exact sizes', async ({ browser }) => {
    await completeMission(fixture, 'MISSION_04');
    await advance(fixture, 'MISSION_05');
    await completeMission(fixture, 'MISSION_05');
    await advance(fixture, 'MISSION_06');
    await expectProjectorMission(browser, 'M06');

    await completeMission(fixture, 'MISSION_06');
    await advance(fixture, 'STORY_BUNKER');
    await advance(fixture, 'BREAK_BEFORE_FINAL');
    await advance(fixture, 'FINAL_30');
    await expectProjectorMission(browser, 'FINAL');

    await rpc(fixture.owner, 'owner_force_open_bunker', {
      p_event_id: fixture.eventId,
      p_reason: 'Проверка финального экрана E2E',
      p_confirmation: FORCE_OPEN_CONFIRMATION,
    });
    await expectProjectorMission(browser, 'FINAL', { unlocked: true });
  });
});
