import { expect, test } from '@playwright/test';

const headline = 'Agents can act. Your limit still decides.';

test.describe('public visual landing page', () => {
  test('leads with the consequence and preserves the product boundary', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: headline })).toBeVisible();
    await expect(page.locator('main > section')).toHaveCount(6);
    await expect(page.locator('[data-visual]')).toHaveCount(10);
    await expect(page.getByText('Refused: PER_TX_CAP')).toBeVisible();
    await expect(page.getByText('Headroom recorded: $100')).toBeVisible();
    await expect(page.getByText(/complete Gol product has not shipped/).first()).toBeVisible();
    await expect(page.getByText('GOL is not the venue.')).toBeVisible();
    await expect(page.getByText(/Mandatory real-user browser acceptance/).last()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('runs both fixed checks from keyboard without external requests', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto('/', { waitUntil: 'networkidle' });

    const within = page.getByRole('button', { name: '$100', exact: true });
    await within.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Run illustrative check' }).click();
    await expect(page.getByText('Checking mandate…')).toBeVisible();
    await expect(page.getByText('Refused: PER_TX_CAP', { exact: true })).toBeHidden();
    await expect(page.getByText('Allowed', { exact: true })).toBeVisible();
    await expect(page.locator('[aria-live="polite"]')).toHaveText(
      'Allowed within illustrative $100 limit',
    );

    await page.getByRole('button', { name: '$101', exact: true }).click();
    await page.getByRole('button', { name: 'Run illustrative check' }).click();
    await expect(page.getByText('Refused: PER_TX_CAP', { exact: true })).toBeVisible();
    await expect(page.locator('[aria-live="polite"]')).toHaveText(
      'Refused: PER_TX_CAP; $100 headroom',
    );

    expect(requests.some((url) => new URL(url).pathname.startsWith('/api/'))).toBe(false);
    const applicationOrigin = new URL(page.url()).origin;
    expect(requests.every((url) => new URL(url).origin === applicationOrigin)).toBe(true);
  });

  test('renders its complete default consequence without JavaScript', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      baseURL: baseURL ?? 'http://127.0.0.1:3100',
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: headline })).toBeVisible();
    await expect(page.getByText('Refused: PER_TX_CAP')).toBeVisible();
    await expect(page.getByText('GOL is not the venue.')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Explore Arc testnet prototype/ }).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '$100', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '$101', exact: true })).toBeDisabled();
    await context.close();
  });

  test('supports skip navigation, anchors, disclosure and route isolation', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    const navigation = page.getByRole('navigation', { name: 'Landing page' });
    await navigation.getByRole('link', { name: 'Mandate' }).click();
    await expect(page).toHaveURL(/#mandate$/);
    await expect(
      page.getByRole('heading', { name: 'Set the edges. Leave the strategy open.' }),
    ).toBeVisible();

    const disclosure = page.getByText('Complete status and evidence boundaries');
    await disclosure.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Repository-supported prototype')).toBeVisible();

    await page.getByRole('link', { name: 'Explore Arc testnet prototype' }).first().click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: 'GOL Network' })).toBeVisible();
  });

  test('meets text, visual, surface and viewport budgets on desktop and mobile', async ({
    page,
  }) => {
    for (const viewport of [
      { width: 390, height: 844, maxViewports: 9 },
      { width: 1440, height: 900, maxViewports: 6.5 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const metrics = await page.evaluate(() => {
        const words = (document.body.innerText.match(/\S+/g) ?? []).length;
        const roundedSurfaces = [...document.querySelectorAll<HTMLElement>('*')].filter(
          (element) => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return (
              box.width > 100 &&
              box.height > 60 &&
              Number.parseFloat(style.borderTopLeftRadius) > 10
            );
          },
        ).length;
        return {
          words,
          roundedSurfaces,
          height: document.documentElement.scrollHeight,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      expect(metrics.words).toBeLessThanOrEqual(500);
      expect(metrics.roundedSurfaces).toBeLessThanOrEqual(16);
      expect(metrics.height / viewport.height).toBeLessThanOrEqual(viewport.maxViewports);
      expect(metrics.overflow).toBe(false);

      const qualifiers = await page.locator('body').innerText();
      expect(qualifiers.match(/prototype/gi)?.length ?? 0).toBeLessThanOrEqual(4);
      expect(qualifiers.match(/design target/gi)?.length ?? 0).toBeLessThanOrEqual(3);
    }
  });

  for (const viewport of [
    { width: 320, height: 800 },
    { width: 640, height: 720 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    test(`has no clipped key content at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const overflow = await page
        .locator('html')
        .evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(overflow).toBe(false);
      for (const label of ['PER_TX_CAP', 'Amount', 'Refused', 'GOL account']) {
        const box = await page
          .getByText(label, { exact: label !== 'PER_TX_CAP' })
          .first()
          .boundingBox();
        expect(box?.width).toBeGreaterThan(0);
        expect(box?.height).toBeGreaterThan(0);
      }
    });
  }

  test('removes landing motion durations and preserves targets under reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const motion = await page.locator('[class*="animate-"]').evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return [style.animationDuration, style.transitionDuration] as const;
      }),
    );
    const milliseconds = (value: string) =>
      value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000;
    expect(
      motion.every(
        ([animation, transition]) =>
          milliseconds(animation) <= 0.01 && milliseconds(transition) <= 0.01,
      ),
    ).toBe(true);
    await expect(page.getByText('Refused: PER_TX_CAP', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '$100', exact: true }).click();
    await page.getByRole('button', { name: 'Run illustrative check' }).click();
    await expect(page.getByText('Allowed', { exact: true })).toBeVisible({ timeout: 100 });
    await expect(page.locator('[aria-live="polite"]')).toHaveText(
      'Allowed within illustrative $100 limit',
    );
  });

  test('keeps every landing control and CTA at least 44 pixels tall on mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const targets = await page
      .locator('main button, main a, header a')
      .evaluateAll((elements) =>
        elements
          .map((element) => element.getBoundingClientRect().height)
          .filter((height) => height > 0),
      );
    expect(targets.length).toBeGreaterThan(0);
    expect(Math.min(...targets)).toBeGreaterThanOrEqual(44);

    await page.getByRole('button', { name: '$100', exact: true }).click();
    await page.getByRole('button', { name: 'Run illustrative check' }).click();
    await expect(page.getByText('Allowed', { exact: true })).toBeVisible({ timeout: 100 });
  });

  test('preserves content and keyboard operation in forced colors', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: headline })).toBeVisible();
    await expect(page.getByText('Refused: PER_TX_CAP', { exact: true })).toBeVisible();

    const amount = page.getByRole('button', { name: '$100', exact: true });
    await amount.focus();
    await expect(amount).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Run illustrative check' }).click();
    await expect(page.getByText('Allowed', { exact: true })).toBeVisible({ timeout: 100 });
  });
});
