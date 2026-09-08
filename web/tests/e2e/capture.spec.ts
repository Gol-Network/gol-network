import { expect, test } from '@playwright/test';

test.skip(process.env.GOL_CAPTURE_SCREENSHOTS !== '1', 'Preview capture is opt-in');

test('capture labeled local preview states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByText('Local preview', { exact: true })).toBeVisible();
  await page.screenshot({
    path: '../assets/screenshots/01-local-preview-setup.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: /Load acceptance fixture/ }).click();
  await page.getByRole('button', { name: 'EXECUTED' }).click();
  await expect(page.getByRole('list').getByText('EXECUTED', { exact: true })).toBeVisible();
  await page.screenshot({
    path: '../assets/screenshots/02-local-preview-executed.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: 'REFUSED' }).click();
  await page.getByRole('button', { name: 'Ask question' }).click();
  await expect(page.getByText(/only 60 USDC remained/)).toBeVisible();
  await page.screenshot({
    path: '../assets/screenshots/03-local-preview-refused.png',
    fullPage: true,
  });
});
