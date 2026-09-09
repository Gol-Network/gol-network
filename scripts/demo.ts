import { randomBytes } from 'node:crypto';

const baseUrl = required('GOL_API_URL').replace(/\/$/, '');
const token = required('GOL_DEV_TOKEN');
const mandateId = required('GOL_DEMO_MANDATE_ID');
const recipientLabel = process.env.GOL_DEMO_RECIPIENT_LABEL ?? 'Design contractor';
const pollIntervalMs = numberFromEnv('GOL_DEMO_POLL_MS', 2_000);
const journalTimeoutMs = numberFromEnv('GOL_DEMO_JOURNAL_TIMEOUT_MS', 180_000);
const graphTimeoutMs = numberFromEnv('GOL_DEMO_GRAPH_TIMEOUT_MS', 180_000);

if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://127.0.0.1')) {
  throw new Error('GOL_API_URL must use HTTPS outside localhost');
}
if (!/^[1-9][0-9]*$/.test(mandateId)) throw new Error('GOL_DEMO_MANDATE_ID must be positive');

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Acceptance failed'}\n`);
  process.exitCode = 1;
});

async function main() {
  const health = await requestJson('/api/health').catch(() => ({}) as Record<string, unknown>);
  const account = await requestJson('/api/account');
  assert(account.state === 'ready', 'Linked account is not ready');
  assert(account.activeMandateId === mandateId, 'Configured mandate is not active');
  assert(account.mandate && typeof account.mandate === 'object', 'Active mandate is unavailable');
  const mandate = account.mandate as Record<string, unknown>;
  assert(mandate.revoked === false, 'Active mandate is revoked');
  assert(mandate.perPaymentCapUnits === '100000000', 'Per-payment cap must be 100 USDC');
  assert(mandate.cumulativeCapUnits === '100000000', 'Cumulative cap must be 100 USDC');
  assert(mandate.spentUnits === '0', 'Acceptance requires a fresh mandate with zero spent');
  assert(BigInt(String(account.balanceUnits)) >= 100_000_000n, 'Account needs at least 100 USDC');

  const accountAddress = String(account.accountAddress);
  const firstRequestId = randomRequestId();
  const secondRequestId = randomRequestId();

  await submit(accountAddress, firstRequestId, `Pay 40 USDC to ${recipientLabel}`);
  const first = await waitForTerminal(firstRequestId);
  assert(first.state === 'executed', `Expected executed, received ${String(first.state)}`);
  assert(isHash(first.txHash), 'Executed result is missing a transaction hash');

  await submit(accountAddress, secondRequestId, `Pay 70 USDC to ${recipientLabel}`);
  const second = await waitForTerminal(secondRequestId);
  assert(second.state === 'refused', `Expected refused, received ${String(second.state)}`);
  assert(
    second.rule === 'CUMULATIVE_CAP',
    `Expected CUMULATIVE_CAP, received ${String(second.rule)}`,
  );
  assert(second.attemptedUnits === '70000000', 'Refusal attempted amount is not 70 USDC');
  assert(second.headroomUnits === '60000000', 'Refusal headroom is not 60 USDC');
  assert(isHash(second.txHash), 'Refusal result is missing a transaction hash');

  const indexed = await waitForIndexed(accountAddress, [firstRequestId, secondRequestId]);
  const indexedRecords = Array.isArray(indexed.records)
    ? (indexed.records as Record<string, unknown>[])
    : [];
  const indexedActionIds = [firstRequestId, secondRequestId].map((id) => ({
    requestId: id,
    actionId: indexedRecords.find((record) => record.requestId === id)?.actionId ?? null,
    transactionHash:
      indexedRecords.find((record) => record.requestId === id)?.transactionHash ?? null,
  }));
  assert(
    indexedActionIds.every((entry) => entry.actionId !== null),
    'The Graph did not report an indexed action for both outcomes',
  );
  const answer = await requestJson('/api/questions', {
    method: 'POST',
    body: { account: accountAddress, question: 'Why was the 70 USDC payment refused?' },
  });
  assert(
    ['answer', 'partial', 'stale'].includes(String(answer.status)),
    'No grounded answer returned',
  );
  assert(Array.isArray(answer.citations) && answer.citations.length > 0, 'Answer has no citation');

  process.stdout.write(
    `${JSON.stringify(
      {
        accepted: true,
        chainId: account.chainId,
        // Public identifiers only. No token or private key is ever printed.
        applicationUrl: baseUrl,
        sourceCommit: health.sourceCommit ?? null,
        account: accountAddress,
        agentAddress: account.agentAddress ?? null,
        signerProvider:
          (account.agentControl as Record<string, unknown> | undefined)?.provider ?? 'privy',
        policyId: (account.agentControl as Record<string, unknown> | undefined)?.policyId ?? null,
        mandateId,
        executed: pickResult(first),
        refused: pickResult(second),
        graph: {
          deployment: indexed.sourceDeployment,
          indexedBlock: indexed.indexedBlock,
          freshness: indexed.freshness,
          actions: indexedActionIds,
        },
        answer: {
          status: answer.status,
          text: answer.text,
          indexedBlock: answer.indexedBlock,
          sourceDeployment: answer.sourceDeployment,
          deterministic: answer.deterministic,
          citations: answer.citations,
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function submit(accountAddress: string, requestId: string, text: string) {
  await requestJson('/api/instructions', {
    method: 'POST',
    body: { account: accountAddress, mandateId, requestId, text },
  });
}

async function waitForTerminal(requestId: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + journalTimeoutMs;
  while (Date.now() < deadline) {
    const result = await requestJson(`/api/requests/${requestId}`);
    const state = String(result.state);
    if (['executed', 'refused'].includes(state)) return result;
    if (['needs_clarification', 'signer_blocked', 'technical_failure', 'unknown'].includes(state)) {
      throw new Error(
        `Request ${requestId} stopped in ${state}: ${String(result.errorCode ?? '')}`,
      );
    }
    await pause(pollIntervalMs);
  }
  throw new Error(`Timed out waiting for request ${requestId}`);
}

async function waitForIndexed(account: string, ids: string[]): Promise<Record<string, unknown>> {
  const deadline = Date.now() + graphTimeoutMs;
  while (Date.now() < deadline) {
    const page = await requestJson(`/api/activity?account=${account}&first=50`);
    const records = Array.isArray(page.records) ? (page.records as Record<string, unknown>[]) : [];
    if (ids.every((id) => records.some((record) => record.requestId === id))) return page;
    if (page.freshness === 'unavailable') throw new Error('Graph activity is unavailable');
    await pause(pollIntervalMs);
  }
  throw new Error('Timed out waiting for both outcomes in The Graph');
}

async function requestJson(
  path: string,
  options?: { method: 'POST'; body: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(options ? { 'content-type': 'application/json' } : {}),
    },
    ...(options ? { body: JSON.stringify(options.body) } : {}),
  });
  const value = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${String(value.error)}`);
  return value;
}

function pickResult(result: Record<string, unknown>) {
  return {
    requestId: result.requestId,
    state: result.state,
    txHash: result.txHash,
    rule: result.rule,
    attemptedUnits: result.attemptedUnits,
    headroomUnits: result.headroomUnits,
  };
}

function randomRequestId() {
  return `0x${randomBytes(32).toString('hex')}`;
}

function isHash(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 100) throw new Error(`${name} is invalid`);
  return parsed;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pause(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
