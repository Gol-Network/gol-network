import { expect, test } from '@playwright/test';

test.describe('wallet sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('gol-theme', 'dark'));
    await page.goto('/app');
    await page.getByRole('button', { name: 'Open fixture demo', exact: true }).click();
  });

  test('shows live account state and filters accounts and networks', async ({ page }) => {
    await page.getByRole('button', { name: 'Open wallet' }).click();

    const wallet = page.getByRole('dialog', { name: 'Your GOL setup' });
    await expect(wallet).toBeVisible();
    await expect(wallet.getByText('Your wallet', { exact: true })).toBeVisible();
    const technicalAddresses = wallet.getByRole('button', { name: /Technical addresses/ });
    await expect(technicalAddresses).toBeVisible();
    await expect(wallet.getByText('Payment funds', { exact: true })).not.toBeVisible();
    await expect(wallet.getByText('Payment agent', { exact: true })).not.toBeVisible();

    await technicalAddresses.click();
    await expect(wallet.getByText('Payment funds', { exact: true })).toBeVisible();
    await expect(wallet.getByText('Payment agent', { exact: true })).toBeVisible();

    await wallet.getByRole('textbox', { name: 'Search addresses' }).fill('agent');
    await expect(wallet.getByText('Payment agent', { exact: true })).toBeVisible();
    await expect(wallet.getByText('Your wallet', { exact: true })).not.toBeVisible();

    await wallet.getByRole('tab', { name: 'Networks' }).click();
    await wallet.getByRole('textbox', { name: 'Search networks' }).fill('Arc');
    await expect(wallet.getByText(/Arc/).first()).toBeVisible();
  });

  test('uses an icon that reflects the current dark theme', async ({ page }) => {
    const themeButton = page.getByRole('button', { name: 'Switch to light theme' });
    await expect(themeButton.locator('svg')).toHaveClass(/lucide-moon/);
  });
});
