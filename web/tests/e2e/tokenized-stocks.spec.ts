import { expect, test, type Page } from '@playwright/test';

const READY = { timeout: 15_000 };

async function openTab(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/tokenized-stocks');
  await expect(page.getByText('MOCK UI', { exact: true })).toBeVisible(READY);
  await expect(page.getByRole('heading', { name: 'Stock tokens' })).toBeVisible(READY);
}

test.describe('tokenized stocks (Base hackathon mock)', () => {
  test.setTimeout(120_000);

  test('tab nav links the Arc page to the mock Base page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Tokenized stocks' }).click();
    await expect(page).toHaveURL(/\/tokenized-stocks$/);
    await expect(page.getByText('MOCK UI', { exact: true })).toBeVisible(READY);
    await page.getByRole('link', { name: 'Arc testnet' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('browse a token, create a Base mandate, then record an approval and a refusal', async ({
    page,
  }) => {
    await openTab(page);

    // The mock market lists every catalog token.
    await expect(page.locator('.stock-table tbody tr')).toHaveCount(10);

    // A row opens the detail view with a chart and range controls.
    await page.locator('.stock-table tbody tr', { hasText: 'NVDAx' }).click();
    const detail = page.getByTestId('token-detail');
    await expect(detail).toBeVisible();
    await expect(detail.locator('.price-chart svg')).toBeVisible();
    await detail.getByRole('button', { name: '7D' }).click();
    await detail.getByRole('button', { name: '← All tokens' }).click();
    await expect(page.getByRole('heading', { name: 'Stock tokens' })).toBeVisible();

    // The desk cannot trade until a mandate is active.
    await expect(page.getByRole('button', { name: 'Preview trade' })).toBeDisabled();
    await expect(page.getByText('Create an active Base mandate before the desk can trade.')).toBeVisible();

    // Create the Base mandate.
    await page.getByRole('button', { name: 'Create mandate on Base' }).click();
    const review = page.getByTestId('mandate-review');
    await expect(review).toBeVisible();
    await review.getByLabel('Per-trade cap (USDC)').fill('2000');
    await review.getByLabel('Cumulative cap (USDC)').fill('10000');
    await page.getByRole('button', { name: 'Sign mandate' }).click();
    await expect(page.getByTestId('mandate-tx')).toContainText('confirmed on Base', READY);
    await expect(page.getByRole('button', { name: 'Preview trade' })).toBeEnabled(READY);

    // An approved trade lands in the portfolio and the audit log.
    await page.getByRole('button', { name: 'Buy 500 USDC of NVDAx' }).click();
    await page.getByRole('button', { name: 'Preview trade' }).click();
    await expect(page.getByTestId('trade-preview')).toContainText('BUY');
    await page.getByRole('button', { name: 'Submit trade' }).click();
    await expect(page.getByTestId('trade-status')).toContainText('EXECUTED', READY);
    await expect(page.locator('.timeline li')).toHaveCount(1);
    await expect(page.locator('.timeline li').first()).toContainText('EXECUTED');

    // A trade over the per-trade cap is a recorded refusal, not a failure.
    await page.getByLabel('Instruction').fill('Buy 999999 USDC of NVDAx');
    await page.getByRole('button', { name: 'Preview trade' }).click();
    await page.getByRole('button', { name: 'Submit trade' }).click();
    await expect(page.getByTestId('trade-status')).toContainText('REFUSED', READY);
    await expect(page.getByTestId('trade-status')).toContainText('PER_TRADE_CAP');
    await expect(page.locator('.timeline li')).toHaveCount(2);

    // The audit log filters over both outcomes.
    await page.getByRole('button', { name: 'REFUSED', exact: true }).click();
    await expect(page.locator('.timeline li')).toHaveCount(1);
    await page.getByRole('button', { name: 'EXECUTED', exact: true }).click();
    await expect(page.locator('.timeline li')).toHaveCount(1);
    await page.getByRole('button', { name: 'ALL', exact: true }).click();
    await expect(page.locator('.timeline li')).toHaveCount(2);
  });
});
