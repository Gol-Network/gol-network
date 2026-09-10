import { expect, test } from '@playwright/test';

test.skip(process.env.GOL_CAPTURE_SCREENSHOTS !== '1', 'Fixture capture is opt-in');

const RECIPIENT = '0xbEef000000000000000000000000000000000004';

test('capture labeled fixture states', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'GOL Network' })).toBeVisible();
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.screenshot({
    path: '../assets/screenshots/01-local-preview-setup.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Open fixture demo', exact: true }).click();
  await page.getByRole('button', { name: /^Create payment account/ }).click();
  await page.getByRole('button', { name: /Choose recipient/ }).click();
  await page.getByLabel('Recipient wallet address').fill(RECIPIENT);
  await page.getByRole('button', { name: /Create payment agent/ }).click();
  await page.getByRole('button', { name: /^Add 1 USDC fee reserve/ }).click();
  await page.getByRole('button', { name: /^Continue to wallet/ }).click();
  await page.getByRole('button', { name: /^Choose amount/ }).click();
  await page.getByLabel('Amount (USDC)').fill('20');
  await page.getByRole('button', { name: /^Review transfer/ }).click();
  await page.getByRole('button', { name: /^Continue to wallet/ }).click();
  await page.getByRole('button', { name: /^Set payment rules/ }).click();
  await page.getByRole('button', { name: /^Save payment rules/ }).click();
  await expect(page.getByText('On', { exact: true }).first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /^Run agent/ }).click();
  await page
    .getByTestId('instruction-preview')
    .getByRole('button', { name: /^Send payment/ })
    .click();
  await expect(page.getByTestId('payment-stage')).toContainText('EXECUTED', { timeout: 30_000 });
  await expect(
    page.getByTestId('activity-timeline').locator('li[data-pending="true"]'),
  ).toHaveCount(0, { timeout: 30_000 });
  await page.screenshot({
    path: '../assets/screenshots/02-local-preview-executed.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: '101 USDC' }).click();
  await page.getByRole('button', { name: /^Run agent/ }).click();
  await page
    .getByTestId('instruction-preview')
    .getByRole('button', { name: /^Send payment/ })
    .click();
  await expect(page.getByTestId('payment-stage')).toContainText('REFUSED', { timeout: 30_000 });
  await expect(
    page.getByTestId('activity-timeline').locator('li[data-pending="true"]'),
  ).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('activity-timeline').locator('li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ask question' }).click();
  await expect(page.getByTestId('grounded-answer')).toContainText('101 USDC was refused', {
    timeout: 30_000,
  });
  await page.screenshot({
    path: '../assets/screenshots/03-local-preview-refused.png',
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('main')).toHaveClass(/theme-dark/);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: '../assets/screenshots/04-local-preview-refused-dark.png',
    fullPage: true,
  });
});
