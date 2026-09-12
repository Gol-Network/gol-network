import { expect, test, type Page } from '@playwright/test';

const RECIPIENT = '0xbEef000000000000000000000000000000000004';
const CONFIRMATION = { timeout: 30_000 };

async function completeStep(page: Page, name: RegExp) {
  await page.getByRole('button', { name }).click();
  await expect(page.getByTestId('owner-transaction')).toContainText(
    /Confirmed on Arc testnet|Awaiting your wallet signature/,
    CONFIRMATION,
  );
}

test.describe('mocked provider walkthrough', () => {
  test.setTimeout(180_000);

  test('switches and persists the visual theme', async ({ page }) => {
    await page.addInitScript(() => {
      if (!window.localStorage.getItem('gol-theme'))
        window.localStorage.setItem('gol-theme', 'dark');
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open fixture demo', exact: true }).click();
    const shell = page.locator('main');

    await expect(shell).toHaveClass(/theme-dark/);
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(shell).toHaveClass(/theme-light/);

    await page.reload();
    await expect(shell).toHaveClass(/theme-light/);
  });

  test('reviews and executes all four owner money actions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open fixture demo', exact: true }).click();

    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('tab', { name: 'Swap', exact: true })).toBeVisible();
    await expect(drawer.getByRole('tab', { name: 'Bridge', exact: true })).toBeVisible();
    await expect(drawer.getByRole('tab', { name: 'Send', exact: true })).toBeVisible();
    await expect(drawer.getByRole('tab', { name: 'Receive', exact: true })).toBeVisible();

    await drawer.getByLabel('Amount', { exact: true }).fill('10');
    await drawer.getByRole('button', { name: 'Review swap' }).click();
    await expect(drawer.getByText('Live route')).toBeVisible();
    await expect(drawer.getByText('Minimum received', { exact: true })).toBeVisible();

    // Any material edit invalidates the old quote, so a stale route can never be signed.
    await drawer.getByRole('button', { name: '0.1%' }).click();
    await expect(drawer.getByRole('button', { name: 'Confirm and sign' })).not.toBeVisible();
    await drawer.getByRole('button', { name: 'Review swap' }).click();
    await drawer.getByRole('button', { name: 'Confirm and sign' }).click();
    await expect(drawer.getByText('Confirmed on-chain.')).toBeVisible(CONFIRMATION);

    await drawer.getByRole('tab', { name: 'Bridge', exact: true }).click();
    await drawer.getByRole('button', { name: 'Review bridge' }).click();
    await expect(drawer.getByText('Fixture bridge')).toBeVisible();
    await drawer.getByRole('button', { name: 'Confirm and sign' }).click();
    await expect(drawer.getByRole('heading', { name: 'Bridge delivered' })).toBeVisible(
      CONFIRMATION,
    );

    await drawer.getByRole('tab', { name: 'Send', exact: true }).click();
    await drawer.getByLabel('Recipient address').fill(RECIPIENT);
    await drawer.getByRole('button', { name: 'Review send' }).click();
    await expect(drawer.getByText('Review transfer')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Confirm and sign' })).toBeVisible();
    await drawer.getByRole('button', { name: 'Confirm and sign' }).click();
    await expect(drawer.getByText('Confirmed on-chain.')).toBeVisible(CONFIRMATION);

    await drawer.getByRole('tab', { name: 'Receive', exact: true }).click();
    await expect(drawer.getByRole('button', { name: 'Copy receive address' })).toBeEnabled();
    await expect(drawer.getByRole('button', { name: 'Copy payment request' })).toBeEnabled();
  });

  test('keeps the combined payment budget usable on a light mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.addInitScript(() => window.localStorage.setItem('gol-theme', 'light'));
    await page.goto('/app');
    await page.getByRole('button', { name: 'Open fixture demo', exact: true }).click();

    await completeStep(page, /^Create payment account/);
    await page.getByRole('button', { name: /Choose recipient/ }).click();
    await page.getByLabel('Recipient wallet address').fill(RECIPIENT);
    await page.getByRole('button', { name: /Create payment agent/ }).click();
    await page.getByRole('button', { name: /^Add 1 USDC fee reserve/ }).click();
    await completeStep(page, /^Continue to wallet/);
    await page.getByRole('button', { name: /^Set payment budget/ }).click();

    const budget = page.getByTestId('payment-budget');
    await expect(budget).toBeVisible(CONFIRMATION);
    await expect(page.locator('main')).toHaveClass(/theme-light/);
    await budget.getByLabel('Maximum per payment').fill('101');
    await budget.getByLabel('Total allowed for 7 days').fill('100');
    await budget.getByRole('button', { name: /^Continue to wallet/ }).click();
    await expect(budget).toContainText('cannot exceed the 7-day total');

    const box = await budget.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  });

  test('completes setup, executes 10, records a 101 refusal, indexes both, and cites them', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Signed-out users see only the authentication gate.
    await expect(page.getByRole('heading', { name: 'GOL Network' })).toBeVisible();
    await expect(page.getByText('FIXTURE MODE', { exact: true })).not.toBeVisible();

    await expect(page.getByRole('button', { name: 'Passkey', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Open fixture demo', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Set up agent payments' })).toBeVisible();
    await page.getByRole('button', { name: 'Open wallet' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Your GOL setup' }).getByText('250 USDC'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    await page.getByRole('button', { name: 'Export' }).click();
    await expect(page.getByRole('dialog')).toContainText('Never share your private key');
    await expect(page.getByRole('dialog')).toContainText(
      'payment account is a contract and has no private key',
    );
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Close wallet' }).click();

    // 3. Payment funds created and confirmed.
    await completeStep(page, /^Create payment account/);
    await expect(page.getByRole('heading', { name: 'Choose who GOL can pay' })).toBeVisible(
      CONFIRMATION,
    );

    // 4. Restricted payment agent provisioned after an explicit recipient review.
    await page.getByRole('button', { name: /Choose recipient/ }).click();
    const consent = page.getByTestId('agent-consent');
    await expect(consent).toContainText('payment funds only');
    await expect(consent).toContainText('your personal wallet');
    await page.getByLabel('Recipient wallet address').fill(RECIPIENT);
    await page.getByRole('button', { name: /Create payment agent|Connect payment agent/ }).click();

    // 5. Privy signers use an owner-funded gas reserve. KMS deployments use the operator-funded
    // reserve and therefore proceed directly to account funding.
    const addAgentFees = page.getByRole('button', { name: /^Add 1 USDC fee reserve/ });
    const setPaymentBudget = page.getByRole('button', { name: /^Set payment budget/ });
    await expect(addAgentFees.or(setPaymentBudget)).toBeVisible(CONFIRMATION);
    if (await addAgentFees.isVisible()) {
      await addAgentFees.click();
      const gasReview = page.getByTestId('transfer-review');
      await expect(gasReview).toContainText('1 USDC');
      await expect(gasReview).toContainText('cannot be used for payments');
      await completeStep(page, /^Continue to wallet/);
    }
    await expect(setPaymentBudget).toBeEnabled(CONFIRMATION);

    // 6. One budget review collects the payment balance and mandate limits. The wallet still
    // receives two explicit requests: one transfer and one mandate signature.
    await setPaymentBudget.click();
    const budget = page.getByTestId('payment-budget');
    await expect(budget).toContainText('0xbEef00...0004');
    await budget.getByLabel('Payment funds').fill('20');
    await budget.getByLabel('Maximum per payment').fill('90');
    await budget.getByLabel('Total allowed for 7 days').fill('100');
    await budget.getByRole('button', { name: /^Continue to wallet/ }).click();
    await expect(page.getByText('On', { exact: true }).first()).toBeVisible(CONFIRMATION);

    // Browser sidebars and narrow windows must not collapse the post-setup workspace.
    for (const width of [320, 960]) {
      await page.setViewportSize({ width, height: 720 });
      await expect(page.getByText('Ready to pay')).toBeVisible();
      const workspace = await page.getByTestId('dashboard-workspace').boundingBox();
      expect(workspace?.height).toBeGreaterThan(500);
    }
    await page.getByRole('button', { name: /Switch to (dark|light) theme/ }).click();
    await expect(page.getByText('Ready to pay')).toBeVisible();
    await page.getByRole('button', { name: /Switch to (dark|light) theme/ }).click();
    await page.setViewportSize({ width: 1440, height: 900 });

    // Withdrawals also accept an owner-selected amount and return only to the owner wallet.
    await expect(page.getByRole('button', { name: 'Withdraw', exact: true }).first()).toBeEnabled(
      CONFIRMATION,
    );
    await page.getByRole('button', { name: 'Withdraw', exact: true }).first().click();
    await page.getByLabel('Amount (USDC)').fill('5');
    await page.getByRole('button', { name: /^Review transfer/ }).click();
    const withdrawalReview = page.getByTestId('transfer-review');
    await expect(withdrawalReview).toContainText('5 USDC');
    await expect(withdrawalReview).toContainText('always return to your wallet');
    await completeStep(page, /^Continue to wallet/);

    // The 10 USDC payment resolves before submission, then reaches a confirmed outcome.
    await page.getByRole('button', { name: /^Run agent/ }).click();
    const preview = page.getByTestId('instruction-preview');
    await expect(preview).toContainText('10 USDC');
    await expect(preview).toContainText(RECIPIENT);
    await preview.getByRole('button', { name: /^Send payment/ }).click();
    await expect(page.getByTestId('payment-stage')).toContainText('EXECUTED', CONFIRMATION);

    // The confirmed result appears immediately as an on-chain, not-yet-indexed overlay.
    await expect(page.getByText('On-chain; indexing pending.').first()).toBeVisible();
    await expect(
      page.getByTestId('activity-timeline').locator('li[data-pending="true"]'),
    ).toHaveCount(1);

    // The indexed record replaces the overlay instead of duplicating the event.
    await expect(
      page.getByTestId('activity-timeline').locator('li[data-pending="true"]'),
    ).toHaveCount(0, CONFIRMATION);
    await expect(page.getByTestId('activity-timeline').locator('li')).toHaveCount(1);

    // The 101 USDC request is a successful on-chain refusal, not a failed payment.
    await page.getByRole('button', { name: '101 USDC' }).click();
    await page.getByRole('button', { name: /^Run agent/ }).click();
    const refusedPreview = page.getByTestId('instruction-preview');
    await expect(refusedPreview).toContainText('101 USDC');
    await refusedPreview.getByRole('button', { name: /^Send payment/ }).click();
    await expect(page.getByTestId('payment-stage')).toContainText('REFUSED', CONFIRMATION);
    await expect(page.getByTestId('payment-stage')).toContainText(
      'The transaction succeeded on-chain and the account contract refused the payment.',
    );
    await expect(page.getByTestId('payment-stage')).toContainText('90 USDC of headroom remained.');
    await expect(
      page.getByTestId('activity-timeline').locator('li[data-pending="true"]'),
    ).toHaveCount(1);
    await expect(
      page.getByText('Successful on-chain refusal: CUMULATIVE_CAP').first(),
    ).toBeVisible();

    // Both outcomes settle into exactly two indexed rows.
    await expect(
      page.getByTestId('activity-timeline').locator('li[data-pending="true"]'),
    ).toHaveCount(0, CONFIRMATION);
    await expect(page.getByTestId('activity-timeline').locator('li')).toHaveCount(2);

    // Filters keep working over the merged timeline.
    await page.getByRole('button', { name: 'REFUSED', exact: true }).click();
    await expect(page.getByTestId('activity-timeline').locator('li')).toHaveCount(1);
    await page.getByRole('button', { name: 'EXECUTED', exact: true }).click();
    await expect(page.getByTestId('activity-timeline').locator('li')).toHaveCount(1);
    await page.getByRole('button', { name: 'ALL', exact: true }).click();
    await expect(page.getByTestId('activity-timeline').locator('li')).toHaveCount(2);

    // The grounded answer exposes its indexing metadata and a clickable citation.
    await page.getByRole('button', { name: 'Ask question' }).click();
    const answer = page.getByTestId('grounded-answer');
    await expect(answer).toContainText('101 USDC was refused', CONFIRMATION);
    await expect(answer).toContainText('Indexed through block');
    await expect(answer).toContainText('Deterministic explanation');
    const citation = answer.locator('.citations a').first();
    await expect(citation).toHaveAttribute('href', /\/tx\/0x[0-9a-f]{64}$/);
    await expect(citation).toHaveAttribute('target', '_blank');
  });
});
