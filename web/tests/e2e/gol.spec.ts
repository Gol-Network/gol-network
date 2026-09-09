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

  test('completes setup, executes 40, records a 70 refusal, indexes both, and cites them', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Signed-out users see only the authentication gate.
    await expect(page.getByRole('button', { name: 'Start fixture walkthrough' })).toBeVisible();
    await expect(page.getByText('FIXTURE MODE', { exact: true })).not.toBeVisible();

    await page.getByRole('button', { name: 'Start fixture walkthrough' }).click();
    await expect(page.getByText('FIXTURE MODE', { exact: true })).toBeVisible();
    await expect(page.getByText('250 USDC', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    await page.getByRole('button', { name: 'Export' }).click();
    await expect(page.getByRole('dialog')).toContainText('Never share your private key');
    await expect(page.getByRole('dialog')).toContainText(
      'GOL smart-contract account itself has no private key',
    );
    await page.getByRole('button', { name: 'Cancel' }).click();

    // 3. GOL account created and confirmed.
    await completeStep(page, /^Create GOL account/);
    await expect(page.getByText('Connect a restricted agent')).toBeVisible(CONFIRMATION);

    // 4. Restricted agent wallet provisioned after an explicit consent review.
    await page.getByRole('button', { name: /Review agent policy/ }).click();
    const consent = page.getByTestId('agent-consent');
    await expect(consent).toContainText('Denied by default');
    await expect(consent).toContainText('Exactly zero');
    await page.getByLabel('Approved recipient address').fill(RECIPIENT);
    await page.getByRole('button', { name: /I understand, provision the agent wallet/ }).click();
    await expect(page.getByText('Agent gas reserve required')).toBeVisible(CONFIRMATION);

    // 5. Agent gas reserve, reviewed then funded separately from the mandate budget.
    await page.getByRole('button', { name: /^Top up agent gas/ }).click();
    const gasReview = page.getByTestId('transfer-review');
    await expect(gasReview).toContainText('1 USDC');
    await expect(gasReview).toContainText('outside the mandate');
    await completeStep(page, /^Sign transfer/);
    await expect(page.getByRole('button', { name: /^Create mandate/ })).toBeEnabled(CONFIRMATION);

    // 6. A mandate can be created while the GOL account still holds no funds.
    await page.getByRole('button', { name: /^Create mandate/ }).click();
    const review = page.getByTestId('mandate-review');
    await expect(review).toContainText(RECIPIENT);
    await review.getByLabel('Per-payment cap (USDC)').fill('90');
    await review.getByLabel('Cumulative cap (USDC)').fill('100');
    await page.getByRole('button', { name: /^Sign mandate/ }).click();
    await expect(page.getByText(/#1 active/).first()).toBeVisible(CONFIRMATION);

    // 7. The owner chooses a deposit amount independently of the mandate amount.
    await page.getByRole('button', { name: 'Deposit', exact: true }).click();
    await page.getByLabel('Amount (USDC)').fill('100');
    await page.getByRole('button', { name: /^Review deposit/ }).click();
    await expect(page.getByTestId('transfer-review')).toContainText('100 USDC');
    await completeStep(page, /^Sign transfer/);
    await expect(page.getByRole('button', { name: 'Withdraw', exact: true })).toBeEnabled(
      CONFIRMATION,
    );

    // Withdrawals also accept an owner-selected amount and return only to the owner wallet.
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
    await page.getByLabel('Amount (USDC)').fill('5');
    await page.getByRole('button', { name: /^Review withdraw/ }).click();
    const withdrawalReview = page.getByTestId('transfer-review');
    await expect(withdrawalReview).toContainText('5 USDC');
    await expect(withdrawalReview).toContainText('immutable owner wallet');
    await completeStep(page, /^Sign transfer/);

    // The 40 USDC payment resolves before submission, then reaches a confirmed outcome.
    await page.getByRole('button', { name: /^Run agent/ }).click();
    const preview = page.getByTestId('instruction-preview');
    await expect(preview).toContainText('40 USDC');
    await expect(preview).toContainText(RECIPIENT);
    await page.getByRole('button', { name: /^Submit request/ }).click();
    await expect(page.getByTestId('payment-stage')).toContainText('EXECUTED', CONFIRMATION);

    // The confirmed result appears immediately as an on-chain, not-yet-indexed overlay.
    await expect(page.getByText('On-chain; indexing pending.').first()).toBeVisible();
    await expect(page.locator('.timeline li.pending-row')).toHaveCount(1);

    // The indexed record replaces the overlay instead of duplicating the event.
    await expect(page.locator('.timeline li.pending-row')).toHaveCount(0, CONFIRMATION);
    await expect(page.locator('.timeline li')).toHaveCount(1);

    // The 70 USDC request is a successful on-chain refusal, not a failed payment.
    await page.getByRole('button', { name: '70 USDC' }).click();
    await page.getByRole('button', { name: /^Run agent/ }).click();
    await expect(page.getByTestId('instruction-preview')).toContainText('70 USDC');
    await page.getByRole('button', { name: /^Submit request/ }).click();
    await expect(page.getByTestId('payment-stage')).toContainText('REFUSED', CONFIRMATION);
    await expect(page.getByTestId('payment-stage')).toContainText(
      'The transaction succeeded on-chain and the account contract refused the payment.',
    );
    await expect(page.getByTestId('payment-stage')).toContainText('60 USDC of headroom remained.');
    await expect(page.locator('.timeline li.pending-row')).toHaveCount(1);
    await expect(
      page.getByText('Successful on-chain refusal · CUMULATIVE_CAP').first(),
    ).toBeVisible();

    // Both outcomes settle into exactly two indexed rows.
    await expect(page.locator('.timeline li.pending-row')).toHaveCount(0, CONFIRMATION);
    await expect(page.locator('.timeline li')).toHaveCount(2);

    // Filters keep working over the merged timeline.
    await page.getByRole('button', { name: 'REFUSED', exact: true }).click();
    await expect(page.locator('.timeline li')).toHaveCount(1);
    await page.getByRole('button', { name: 'EXECUTED', exact: true }).click();
    await expect(page.locator('.timeline li')).toHaveCount(1);
    await page.getByRole('button', { name: 'ALL', exact: true }).click();
    await expect(page.locator('.timeline li')).toHaveCount(2);

    // The grounded answer exposes its indexing metadata and a clickable citation.
    await page.getByRole('button', { name: 'Ask question' }).click();
    const answer = page.getByTestId('grounded-answer');
    await expect(answer).toContainText('70 USDC was refused', CONFIRMATION);
    await expect(answer).toContainText('Indexed through block');
    await expect(answer).toContainText('Deterministic explanation');
    const citation = answer.locator('.citations a').first();
    await expect(citation).toHaveAttribute('href', /\/tx\/0x[0-9a-f]{64}$/);
    await expect(citation).toHaveAttribute('target', '_blank');
  });
});
