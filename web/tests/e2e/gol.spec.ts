import { expect, test } from '@playwright/test';

test('local judge preview demonstrates execution, refusal, filtering, and explanation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Give the agent a budget/ })).toBeVisible();
  await expect(page.getByText('Local preview', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Load acceptance fixture/ }).click();
  await expect(page.getByRole('list').getByText('EXECUTED', { exact: true })).toBeVisible();
  await expect(page.getByRole('list').getByText('REFUSED', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'REFUSED' }).click();
  await expect(page.getByText('Cumulative cap exceeded')).toBeVisible();
  await expect(page.getByText('Paid 0xbbbbbb...bbbb')).toHaveCount(0);

  await page.getByRole('button', { name: 'Ask question' }).click();
  await expect(page.getByText(/only 60 USDC remained/)).toBeVisible();
});
