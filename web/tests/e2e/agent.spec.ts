import { expect, test, type Page } from '@playwright/test';

const RECIPIENT = '0xbEef000000000000000000000000000000000004';

async function completeFixtureSetup(page: Page) {
  await page.getByRole('button', { name: /^Create payment account/ }).click();
  await expect(page.getByRole('heading', { name: 'Choose who GOL can pay' })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole('button', { name: /Choose recipient/ }).click();
  await page.getByLabel('Recipient wallet address').fill(RECIPIENT);
  await page.getByRole('button', { name: /Create payment agent/ }).click();
  await expect(page.getByRole('heading', { name: 'Add agent network fees' })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole('button', { name: /^Add 1 USDC fee reserve/ }).click();
  await page.getByRole('button', { name: /^Continue to wallet/ }).click();
  await expect(page.getByRole('heading', { name: 'Set your payment budget' })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole('button', { name: /^Set payment budget/ }).click();
  const budget = page.getByTestId('payment-budget');
  await budget.getByLabel('Payment funds').fill('20');
  await page.getByRole('button', { name: /^Continue to wallet/ }).click();
  await expect(page.getByRole('heading', { name: 'GOL Agent' })).toBeVisible({ timeout: 30_000 });
}

test.describe('AG-UI agent workflow', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open fixture demo', exact: true }).click();
  });

  test('streams an Aave MCP result into its protocol card', async ({ page }) => {
    await completeFixtureSetup(page);
    await page.getByLabel('Message GOL Agent').fill('Best USDC yield');
    await page.getByRole('button', { name: 'Run agent', exact: true }).click();

    await expect(page.getByText(/The live Aave MCP result is ready/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Live protocol data')).toBeVisible();
    await expect(page.getByText('MCP verified')).toBeVisible();
    const activity = page.getByLabel('Agent tool activity');
    await expect(activity.getByText('Get Markets')).toBeVisible();
    await expect(activity.getByText('Complete')).toBeVisible();
    await expect(page.getByText('NEEDS_CLARIFICATION')).toHaveCount(0);
  });

  test('keeps the agent unavailable until account setup is complete', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Set up agent payments' })).toBeVisible();
    await expect(page.getByLabel('Message GOL Agent')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Create payment account/ })).toBeVisible();
  });

  test('reviews and signs a prepared Aave transaction only after owner confirmation', async ({
    page,
  }) => {
    await completeFixtureSetup(page);
    const threadId = 'fixture-aave-thread';
    const runId = 'fixture-aave-run';
    const callId = 'fixture-aave-call';
    const messageId = 'fixture-aave-message';
    const result = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            data: {
              __typename: 'TransactionRequest',
              to: '0x973a023A77420ba610f06b3858aD991Df6d85A08',
              from: '0xC0FFEe0000000000000000000000000000000001',
              data: '0x852a56a5',
              value: '0',
              chainId: 1,
              operations: ['SPOKE_SUPPLY'],
            },
          }),
        },
      ],
    };
    const events = [
      { type: 'RUN_STARTED', threadId, runId },
      {
        type: 'TOOL_CALL_START',
        toolCallId: callId,
        toolCallName: 'prepare_action',
        parentMessageId: messageId,
      },
      { type: 'TOOL_CALL_ARGS', toolCallId: callId, delta: '{}' },
      { type: 'TOOL_CALL_END', toolCallId: callId },
      {
        type: 'TOOL_CALL_RESULT',
        messageId: `${messageId}-result`,
        toolCallId: callId,
        content: JSON.stringify({ source: 'aave', tool: 'prepare_action', result }),
      },
      { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' },
      {
        type: 'TEXT_MESSAGE_CONTENT',
        messageId,
        delta: 'The unsigned Aave supply action is ready for review.',
      },
      { type: 'TEXT_MESSAGE_END', messageId },
      { type: 'RUN_FINISHED', threadId, runId },
    ];
    await page.route('**/api/agent/run', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
      });
    });

    const composer = page.getByLabel('Message GOL Agent');
    await composer.fill('Supply 1 USDC on Aave');
    await page.getByRole('button', { name: 'Run agent', exact: true }).click();
    await expect(page.getByText('Supply preview')).toBeVisible();
    await page.getByRole('button', { name: /Open review/ }).click();

    const review = page.getByTestId('aave-transaction-review');
    await expect(review).toContainText('Ethereum');
    await expect(review).toContainText('SPOKE_SUPPLY');
    await review.getByRole('button', { name: /Review in wallet/ }).click();
    await expect(page.getByTestId('owner-transaction')).toContainText('Confirmed on Aave network', {
      timeout: 30_000,
    });
  });

  test('routes user-friendly GOL wording into the matching owner review', async ({ page }) => {
    await completeFixtureSetup(page);
    const composer = page.getByLabel('Message GOL Agent');

    await composer.fill('Review my payment rule');
    await page.getByRole('button', { name: 'Run agent', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Set payment rules' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Open review' }).click();
    await expect(page.getByRole('heading', { name: 'Set payment rules' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await composer.fill('Add payment funds');
    await page.getByRole('button', { name: 'Run agent', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Add payment funds' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Open review' }).last().click();
    await expect(page.getByRole('heading', { name: 'Add payment funds' })).toBeVisible();
    await expect(page.getByLabel('Amount (USDC)')).toBeVisible();
  });
});
