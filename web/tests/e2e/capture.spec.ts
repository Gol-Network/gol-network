import { expect, test } from '@playwright/test';

test.skip(process.env.GOL_CAPTURE_SCREENSHOTS !== '1', 'Fixture capture is opt-in');

const RECIPIENT = '0xbEef000000000000000000000000000000000004';

test('capture labeled fixture states', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByText('FIXTURE MODE', { exact: true })).toBeVisible();
  await page.screenshot({
    path: '../assets/screenshots/01-local-preview-setup.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Start fixture walkthrough' }).click();
  await page.getByRole('button', { name: /^Create GOL account/ }).click();
  await page.getByRole('button', { name: /Review and provision agent wallet/ }).click();
  await page.getByLabel('Approved recipient address').fill(RECIPIENT);
  await page.getByRole('button', { name: /I understand, provision the agent wallet/ }).click();
  await page.getByRole('button', { name: /^Top up agent gas/ }).click();
  await page.getByRole('button', { name: /^Sign transfer/ }).click();
  await page.getByRole('button', { name: /^Fund GOL account/ }).click();
  await page.getByRole('button', { name: /^Sign transfer/ }).click();
  await page.getByRole('button', { name: /^Review mandate/ }).click();
  await page.getByRole('button', { name: /^Sign mandate/ }).click();
  await expect(page.getByText('SETUP 7 OF 7')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /^Run agent/ }).click();
  await page.getByRole('button', { name: /^Submit request/ }).click();
  await expect(page.getByTestId('payment-stage')).toContainText('EXECUTED', { timeout: 30_000 });
  await expect(page.locator('.timeline li.pending-row')).toHaveCount(0, { timeout: 30_000 });
  await page.screenshot({
    path: '../assets/screenshots/02-local-preview-executed.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: '70 USDC' }).click();
  await page.getByRole('button', { name: /^Run agent/ }).click();
  await page.getByRole('button', { name: /^Submit request/ }).click();
  await expect(page.getByTestId('payment-stage')).toContainText('REFUSED', { timeout: 30_000 });
  await expect(page.locator('.timeline li.pending-row')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('.timeline li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ask question' }).click();
  await expect(page.getByTestId('grounded-answer')).toContainText('70 USDC was refused', {
    timeout: 30_000,
  });
  await page.screenshot({
    path: '../assets/screenshots/03-local-preview-refused.png',
    fullPage: true,
  });
});
