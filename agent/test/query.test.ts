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
import {
  buildActivityQuery,
  getActivity,
  getAnswerEvidence,
  type ChainHeadSource,
  type GraphTransport,
} from '../src/query/activity.js';
import { answerQuestion } from '../src/query/answer.js';

const ACCOUNT = '0x0000000000000000000000000000000000Acc017' as Address;
const AGENT = '0x00000000000000000000000000000000000A6E17' as Address;
const RECIPIENT = '0x000000000000000000000000000000000000bEEF' as Address;
const TX = `0x${'20'.repeat(32)}` as Hex32;
const scope: AccountScope = { chainId: ARC_TESTNET_CHAIN_ID, account: ACCOUNT };

const refusal: ActivityRecord = {
  actionId: `${TX}00000005`,
  requestId: `0x${'02'.repeat(32)}`,
  mandateId: '1',
  agent: AGENT,
  recipient: RECIPIENT,
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

function rawAction(record: ActivityRecord, account = ACCOUNT) {
  return {
    ...record,
    id: record.actionId,
    account: { id: account.toLowerCase() },
    mandate: {
      id: `${account.toLowerCase()}:${record.mandateId}`,
      mandateId: record.mandateId,
      cumulativeCap: '100000000',
    },
  };
}

const meta = {
  block: { number: 100, hash: refusal.blockHash, timestamp: 1_800_000_000 },
  hasIndexingErrors: false,
  deployment: 'QmDeployment',
};

const head: ChainHeadSource = {
  getHead: async () => ({ number: 101n, timestamp: 1_800_000_010n }),
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
    const request = vi.fn(async () => ({ data: { actions: [rawAction(refusal)], _meta: meta } }));
    const result = await getActivity(scope, { first: 50 }, { request }, head);
    expect(result).toMatchObject({ freshness: 'current', indexedBlock: '100' });
    expect(result.records).toHaveLength(1);
  });

  it('applies every filter in the where clause before pagination', () => {
    const { query, variables } = buildActivityQuery(scope, {
      first: 50,
      outcome: 'REFUSED',
      rule: 'CUMULATIVE_CAP',
      mandateId: '1',
      fromTimestamp: '1000',
      toTimestamp: '2000',
      cursor: '9',
    });
    expect(query).toContain('outcome: $outcome');
    expect(query).toContain('rule: $rule');
    expect(query).toContain('mandate: $mandate');
    expect(query).toContain('timestamp_gte: $fromTimestamp');
    expect(query).toContain('timestamp_lte: $toTimestamp');
    expect(query).toContain('sequence_lt: $before');
    expect(variables).toMatchObject({
      account: ACCOUNT.toLowerCase(),
      outcome: 'REFUSED',
      rule: 'CUMULATIVE_CAP',
      mandate: `${ACCOUNT.toLowerCase()}:1`,
      fromTimestamp: '1000',
      toTimestamp: '2000',
      before: '9',
      first: 50,
    });
  });

  it('clamps the visible timeline page to fifty records', () => {
    expect(buildActivityQuery(scope, { first: 500 }).variables.first).toBe(50);
    expect(buildActivityQuery(scope, { first: 0 }).variables.first).toBe(1);
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

  it('treats an out-of-scope or malformed response as an integrity mismatch', async () => {
    const foreign: GraphTransport = {
      request: async () => ({
        data: {
          actions: [rawAction(refusal, '0x000000000000000000000000000000000000dEaD' as Address)],
          _meta: meta,
        },
      }),
    };
    const mismatch = await getActivity(scope, { first: 50 }, foreign, head);
    expect(mismatch.freshness).toBe('unavailable');
    expect(mismatch.integrityMismatch).toBe(true);
    expect(mismatch.records).toHaveLength(0);

    const malformed: GraphTransport = {
      request: async () => ({
        data: { actions: [{ ...rawAction(refusal), transactionHash: '0xnothash' }], _meta: meta },
      }),
    };
    expect((await getActivity(scope, { first: 50 }, malformed, head)).integrityMismatch).toBe(true);
  });
});

describe('question evidence pagination', () => {
  function pagedTransport(total: number): GraphTransport {
    return {
      request: async (body) => {
        const before = String(body.variables.before);
        const size = Number(body.variables.first);
        const start =
          before === '340282366920938463463374607431768211455' ? total : Number(before) - 1;
        const actions = [];
        for (let sequence = start; sequence > Math.max(start - size, 0); sequence -= 1) {
          actions.push(
            rawAction({
              ...refusal,
              actionId: `0x${sequence.toString(16).padStart(72, '0')}`,
              requestId: `0x${sequence.toString(16).padStart(64, '0')}`,
              sequence: String(sequence),
            }),
          );
        }
        return { data: { actions, _meta: meta } };
      },
    };
  }

  it('stops at one hundred scoped records and reports truncation', async () => {
    const result = await getAnswerEvidence(scope, {}, pagedTransport(180), head);
    expect(result.records).toHaveLength(100);
    expect(result.partial).toBe(true);
  });

  it('does not report truncation when the whole history fits', async () => {
    const result = await getAnswerEvidence(scope, {}, pagedTransport(30), head);
    expect(result.records).toHaveLength(30);
    expect(result.partial).toBe(false);
  });
});

describe('grounded answers', () => {
  it('explains 70, 60, and 40 from the indexed refusal with a trusted citation', async () => {
    const answer = await answerQuestion(
      scope,
      'Why was 70 refused?',
      { get: async () => page() },
      'https://testnet.arcscan.app',
    );
    expect(answer.text).toContain('70 USDC');
    expect(answer.text).toContain('60 USDC');
    expect(answer.text).toContain('40 USDC');
    expect(answer.citations[0]).toMatchObject({ txHash: TX, logIndex: '5' });
    expect(answer.citations[0]!.explorerUrl).toBe(`https://testnet.arcscan.app/tx/${TX}`);
    expect(answer.deterministic).toBe(true);
    expect(answer.recordCount).toBe(1);
    expect(answer.indexedBlock).toBe('100');
    expect(answer.sourceDeployment).toBe('QmDeployment');
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
    expect(answer.deterministic).toBe(true);
    expect(answer.citations).toHaveLength(1);
  });

  it('keeps the deterministic explanation when the model is unavailable', async () => {
    const model: JsonModel = {
      completeJson: async () => {
        throw new Error('model timeout');
      },
    };
    const answer = await answerQuestion(
      scope,
      'Why refused?',
      { get: async () => page() },
      'https://explorer.example',
      model,
    );
    expect(answer.status).toBe('model_error');
    expect(answer.text).toContain('Explanation unavailable');
    expect(answer.text).toContain('60 USDC');
    expect(answer.citations[0]!.explorerUrl).toContain(TX);
  });
});
