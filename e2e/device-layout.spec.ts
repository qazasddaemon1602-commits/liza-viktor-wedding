import { expect, test, type Page } from '@playwright/test';

const OWNER_EMAIL = 'owner@wedding.test';
const OWNER_PASSWORD = 'WeddingTest!2026';

async function loginOwner(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email владельца').fill(OWNER_EMAIL);
  await page.getByLabel('Пароль').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'ВОЙТИ В АДМИНКУ' }).click();
  await expect(page.getByRole('heading', { name: 'Лиза × Виктор' })).toBeVisible();
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

test('owner admin is usable on a 390px phone without horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await loginOwner(page);
  await expect(page.getByRole('heading', { name: 'РЕПЕТИЦИЯ' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ОТКРЫТЬ ТВ' })).toBeVisible();
  await expect(page.getByRole('button', { name: /ЗАФИКСИРОВАТЬ СОСТАВ|СОСТАВ ЗАФИКСИРОВАН/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await context.close();
});

test('main projector fits a 1920x1080 TV and keeps the QR call to action visible', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto('/screen');
  await expect(page.getByRole('heading', { name: 'ПОЛУЧИТЕ СВОЙ БИЛЕТ' })).toBeVisible();
  await expect(page.locator('.screen-qr')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const qrBox = await page.locator('.screen-qr').boundingBox();
  expect(qrBox).not.toBeNull();
  expect(qrBox!.x).toBeGreaterThanOrEqual(0);
  expect(qrBox!.y).toBeGreaterThanOrEqual(0);
  expect(qrBox!.x + qrBox!.width).toBeLessThanOrEqual(1920);
  expect(qrBox!.y + qrBox!.height).toBeLessThanOrEqual(1080);

  await context.close();
});
