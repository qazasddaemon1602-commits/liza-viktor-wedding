import { expect, test, type Browser, type Page } from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';

const phoneWidths = [320, 360, 390, 430, 768] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport + 1);
}

async function loginOwner(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email владельца').fill(OWNER_EMAIL);
  await page.getByLabel('Пароль').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'ВОЙТИ В АДМИНКУ' }).click();
  await expect(page.getByRole('heading', { name: 'Лиза × Виктор' })).toBeVisible();
}

async function withPhone(
  browser: Browser,
  width: number,
  height: number,
  run: (page: Page) => Promise<void>,
) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
  });
  try {
    await run(await context.newPage());
  } finally {
    await context.close();
  }
}

for (const width of phoneWidths) {
  test(`join form has no horizontal overflow at ${width}px`, async ({ browser }) => {
    await withPhone(browser, width, width === 768 ? 1024 : 844, async (page) => {
      await page.goto('/join');
      await expect(page.getByLabel('Имя')).toBeVisible();
      await expect(page.getByLabel('Фамилия')).toBeVisible();
      await expect(page.getByRole('button', { name: 'ПОЛУЧИТЬ БИЛЕТ' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

for (const width of [320, 390, 430, 768] as const) {
  test(`owner dashboard remains usable at ${width}px`, async ({ browser }) => {
    await withPhone(browser, width, width === 768 ? 1024 : 844, async (page) => {
      await loginOwner(page);
      await expect(page.getByRole('heading', { name: 'РЕПЕТИЦИЯ' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'ОТКРЫТЬ ТВ' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
}

test('320px quiz answers stack and their labels stay inside the tap target', async ({ browser }) => {
  await withPhone(browser, 320, 568, async (page) => {
    await page.goto('/join');
    await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.setAttribute('data-testid', 'mobile-quiz-fixture');
      fixture.style.width = '100%';
      fixture.innerHTML = `
        <div class="quiz-choices">
          <button class="quiz-choice quiz-choice-liza"><span>A</span><strong>ЛИЗА</strong></button>
          <button class="quiz-choice quiz-choice-viktor"><span>B</span><strong>ВИКТОР</strong></button>
        </div>`;
      document.body.appendChild(fixture);
    });

    const choices = page.locator('[data-testid="mobile-quiz-fixture"] .quiz-choices');
    const columns = await choices.evaluate((element) => getComputedStyle(element).gridTemplateColumns);
    expect(columns.trim().split(/\s+/)).toHaveLength(1);

    const viktor = page.locator('[data-testid="mobile-quiz-fixture"] .quiz-choice-viktor');
    const buttonBox = await viktor.boundingBox();
    const labelBox = await viktor.locator('strong').boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    expect(labelBox!.width).toBeLessThanOrEqual(buttonBox!.width);
    await expectNoHorizontalOverflow(page);
  });
});

test('projector audio control keeps a 44px touch target on a phone', async ({ browser }) => {
  await withPhone(browser, 390, 844, async (page) => {
    await page.goto('/screen');
    const toggle = page.getByRole('button', { name: /Включить звук|Выключить звук/ });
    await expect(toggle).toBeVisible();
    const box = await toggle.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
  });
});

test('Bunker emergency fits a 844x390 landscape recovery viewport', async ({ browser }) => {
  await withPhone(browser, 844, 390, async (page) => {
    await page.goto('/join');
    await page.evaluate(() => {
      const scene = document.createElement('section');
      scene.className = 'bunker-emergency';
      scene.setAttribute('data-testid', 'mobile-bunker-fixture');
      scene.innerHTML = `
        <header class="bunker-emergency__header">
          <span class="bunker-emergency__signal"></span>
          <strong>ЭКСТРЕННОЕ СООБЩЕНИЕ</strong>
          <span>ПОЕЗД ВИКТОРА · СИСТЕМА ОПОВЕЩЕНИЯ</span>
        </header>
        <div class="bunker-emergency__content">
          <p>ПОЕЗД ИЗМЕНИЛ МАРШРУТ.</p>
          <h1>БУНКЕР</h1>
          <p>ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА</p>
          <div class="bunker-emergency__timer-block">
            <span>ВРЕМЯ ДО ПРИБЫТИЯ</span>
            <strong>30:00</strong>
          </div>
        </div>
        <footer class="bunker-emergency__footer">
          <span>СОХРАНЯЙТЕ СПОКОЙСТВИЕ</span>
          <span>МАРШРУТ ПЕРЕСТРОЕН</span>
        </footer>`;
      document.body.appendChild(scene);
    });

    for (const selector of [
      '.bunker-emergency__header',
      '.bunker-emergency__content',
      '.bunker-emergency__timer-block',
      '.bunker-emergency__footer',
    ]) {
      const box = await page.locator(`[data-testid="mobile-bunker-fixture"] ${selector}`).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(-1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(391);
    }
    await expectNoHorizontalOverflow(page);
  });
});

test('Mortal Kombat guest page has no horizontal overflow at 320px', async ({ browser }) => {
  await withPhone(browser, 320, 568, async (page) => {
    await page.goto('/mortal-kombat');
    await expect(page.locator('.mk-page')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
