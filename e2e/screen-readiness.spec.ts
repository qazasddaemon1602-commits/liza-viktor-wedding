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
  await expect(owner.getByText('ИНДИКАЦИЯ · НЕ БЛОКИРУЕТ')).toBeVisible();

  await ownerContext.close();
  await screenContext.close();
});

