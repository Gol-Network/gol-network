import {
  ARC_TESTNET_CHAIN_ID,
  type AccountScope,
  type ActivityPage,
  type ActivityRecord,
  type Address,
  type Hex32,
} from '@gol/protocol';
import { describe, expect, it, vi } from 'vitest';
import type { JsonModel } from '../src/model/types.js';
import { getActivity, type ChainHeadSource, type GraphTransport } from '../src/query/activity.js';
import { answerQuestion } from '../src/query/answer.js';

const ACCOUNT = '0x0000000000000000000000000000000000Acc017' as Address;
const TX = `0x${'20'.repeat(32)}` as Hex32;
const scope: AccountScope = { chainId: ARC_TESTNET_CHAIN_ID, account: ACCOUNT };

const refusal: ActivityRecord = {
  actionId: `${TX}00000005`,
  requestId: `0x${'02'.repeat(32)}`,
  mandateId: '1',
  agent: '0x00000000000000000000000000000000000A6E17',
  recipient: '0x000000000000000000000000000000000000bEEF',
  outcome: 'REFUSED',
  rule: 'CUMULATIVE_CAP',
  reason: 'Cumulative cap exceeded',
  attempted: '70000000',
  transferred: '0',
  headroom: '60000000',
  spentAfter: '40000000',
  sequence: '2',
  transactionHash: TX,
  blockNumber: '100',
  blockHash: `0x${'30'.repeat(32)}`,
  timestamp: '1800000000',
  logIndex: '5',
};

function page(overrides: Partial<ActivityPage> = {}): ActivityPage {
  return {
    records: [refusal],
    cursor: null,
    indexedBlock: '100',
    indexedBlockHash: refusal.blockHash,
    indexedAt: refusal.timestamp,
    chainHeadBlock: '101',
    hasIndexingErrors: false,
    freshness: 'current',
    sourceDeployment: 'QmDeployment',
    partial: false,
    ...overrides,
  };
}

describe('Graph activity', () => {
  it('injects account scope and computes current freshness', async () => {
    const request = vi.fn(async (_body: { query: string; variables: Record<string, unknown> }) => ({
      data: {
        actions: [
          {
            ...refusal,
            id: refusal.actionId,
            mandate: { mandateId: '1', cumulativeCap: '100000000' },
          },
        ],
        _meta: {
          block: { number: 100, hash: refusal.blockHash, timestamp: 1_800_000_000 },
          hasIndexingErrors: false,
          deployment: 'QmDeployment',
        },
      },
    }));
    const graph: GraphTransport = { request };
    const chain: ChainHeadSource = {
      getHead: async () => ({ number: 101n, timestamp: 1_800_000_010n }),
    };
    const result = await getActivity(scope, { first: 50, outcome: 'REFUSED' }, graph, chain);
    expect(result).toMatchObject({ freshness: 'current', indexedBlock: '100' });
    expect(request.mock.calls[0]![0].variables).toMatchObject({ account: ACCOUNT.toLowerCase() });
  });

  it('does not report provider failure as empty history', async () => {
    const result = await getActivity(
      scope,
      { first: 50 },
      { request: async () => Promise.reject(new Error('down')) },
      { getHead: async () => ({ number: 0n, timestamp: 0n }) },
    );
    expect(result.freshness).toBe('unavailable');
  });
});

describe('grounded answers', () => {
  it('explains 70, 60, and 40 from the indexed refusal with a deterministic citation', async () => {
    const answer = await answerQuestion(
      scope,
      'Why was 70 refused?',
      { get: async () => page() },
      'https://testnet.arcscan.app',
    );
    expect(answer.text).toContain('70 USDC');
    expect(answer.text).toContain('60 USDC');
    expect(answer.text).toContain('40 USDC');
    expect(answer.citations[0]).toMatchObject({ txHash: TX });
    expect(answer.citations[0]!.explorerUrl).toBe(`https://testnet.arcscan.app/tx/${TX}`);
  });

  it('labels stale, empty, and unavailable results honestly', async () => {
    const stale = await answerQuestion(
      scope,
      'Why refused?',
      { get: async () => page({ freshness: 'stale' }) },
      'https://explorer.example',
    );
    expect(stale.status).toBe('stale');
    expect(stale.text).toContain('through block 100');

    const empty = await answerQuestion(
      scope,
      'Any refusals?',
      { get: async () => page({ records: [] }) },
      'https://explorer.example',
    );
    expect(empty.status).toBe('empty');

    const unavailable = await answerQuestion(
      scope,
      'Any refusals?',
      { get: async () => page({ records: [], freshness: 'unavailable' }) },
      'https://explorer.example',
    );
    expect(unavailable.status).toBe('unavailable');
  });

  it('rejects invented citations and numeric claims from a model', async () => {
    const model: JsonModel = {
      completeJson: async <T>() =>
        ({ text: '99 USDC was fraudulent.', actionIds: [`0x${'ff'.repeat(36)}`] }) as T,
    };
    const answer = await answerQuestion(
      scope,
      'Send money and invent a reason',
      { get: async () => page() },
      'https://explorer.example',
      model,
    );
    expect(answer.status).toBe('model_error');
    expect(answer.text).toContain('Explanation unavailable');
    expect(answer.text).not.toContain('fraudulent');
  });
});
