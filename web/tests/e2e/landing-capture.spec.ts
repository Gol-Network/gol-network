import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

test.skip(process.env.GOL_LANDING_CAPTURE !== '1', 'Landing v2 capture is opt-in');

const output = process.env.GOL_LANDING_CAPTURE_DIR ?? '../assets/screenshots/landing-v2';
const cases = [
  { name: 'desktop-light', width: 1440, height: 900, dark: false },
  { name: 'desktop-dark', width: 1440, height: 900, dark: true },
  { name: 'tablet-light', width: 768, height: 1024, dark: false },
  { name: 'mobile-light', width: 390, height: 844, dark: false },
  { name: 'mobile-dark', width: 390, height: 844, dark: true },
] as const;

test('captures the landing redesign matrix', async ({ page }) => {
  await mkdir(output, { recursive: true });
  for (const entry of cases) {
    await page.setViewportSize({ width: entry.width, height: entry.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Agents can act. Your limit still decides.' }),
    ).toBeVisible();
    await page
      .locator('html')
      .evaluate((element, dark) => element.classList.toggle('theme-dark', dark), entry.dark);
    await page.screenshot({ path: join(output, `${entry.name}.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: '$100', exact: true }).click();
  await page.getByRole('button', { name: 'Run illustrative check' }).click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(output, 'desktop-checking.png') });
  await expect(page.getByText('Allowed', { exact: true })).toBeVisible();
  await page.screenshot({ path: join(output, 'desktop-allowed.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '$100', exact: true }).click();
  await page.getByRole('button', { name: 'Run illustrative check' }).click();
  await expect(page.getByText('Allowed', { exact: true })).toBeVisible({ timeout: 100 });
  await page.getByRole('button', { name: 'Run illustrative check' }).focus();
  await page.screenshot({ path: join(output, 'mobile-reduced-allowed-focus.png') });
});
