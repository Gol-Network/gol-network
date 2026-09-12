import { expect, test } from '@playwright/test';

const DISCOVERED_AAVE_TOOLS = [
  {
    name: 'get_markets',
    title: 'Get markets',
    description:
      'Compare Aave markets, reserves, liquidity, and current rates across supported networks.',
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_user_summary',
    title: 'Review Aave position',
    description:
      'Summarize supplied assets, debt, available borrowing power, and the current health factor.',
    annotations: { readOnlyHint: true },
  },
  {
    name: 'prepare_action',
    title: 'Prepare Aave action',
    description:
      'Prepare an unsigned supply, withdraw, borrow, or repay transaction for owner review.',
    annotations: { destructiveHint: true },
  },
];

test.describe('UI and UX coverage', () => {
  test('keeps setup and the action drawer usable on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await page.getByRole('button', { name: 'Open fixture demo', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Set up agent payments' })).toBeVisible();
    await expect(page.getByText('Your wallet', { exact: true })).toBeVisible();
    await expect(page.getByText('Payment setup', { exact: true })).toBeVisible();
    await expect(page.getByText('Funds and rules', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create payment account' })).toBeVisible();
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);

    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('tab', { name: 'Swap', exact: true })).toBeVisible();
    await expect(drawer.getByRole('tab', { name: 'Bridge', exact: true })).toBeVisible();
    await expect(drawer.getByRole('tab', { name: 'Send', exact: true })).toBeVisible();
    await expect(drawer.getByRole('tab', { name: 'Receive', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);
  });

  test('lists GOL and discovered Aave tools with readable equal-height cards', async ({ page }) => {
    await page.route('**/api/aave/mcp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tools: DISCOVERED_AAVE_TOOLS }),
      });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/tools');

    const golCards = page.locator('[data-tool-source="gol"]');
    const aaveCards = page.locator('[data-tool-source="aave"]');
    await expect(golCards).toHaveCount(12);
    await expect(aaveCards).toHaveCount(DISCOVERED_AAVE_TOOLS.length);
    await expect(page.getByRole('heading', { name: 'Add agent wallet' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Set spending limit' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review Aave position' })).toBeVisible();

    const heights = await golCards.evaluateAll((cards) =>
      cards.map((card) => Math.round(card.getBoundingClientRect().height)),
    );
    expect(new Set(heights).size).toBe(1);
    await expect(golCards.first().locator('p')).toHaveCSS('overflow-y', 'auto');

    await page.getByRole('button', { name: 'Use light theme' }).click();
    await expect(page.locator('main')).toHaveClass(/theme-light/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Connected tools' })).toBeVisible();
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);
  });
});
