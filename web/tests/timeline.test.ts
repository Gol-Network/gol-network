import type { ActivityRecord } from '@gol/protocol';
import { describe, expect, it } from 'vitest';
import { filterTimeline, isIndexed, mergeTimeline, type PendingActivity } from '@/client/timeline';

const TX = `0x${'ab'.repeat(32)}` as const;
const REQUEST = `0x${'01'.repeat(32)}` as const;

const indexedRefusal: ActivityRecord = {
  actionId: `${TX}00000000`,
  requestId: REQUEST,
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
  blockHash: `0x${'cd'.repeat(32)}`,
  timestamp: '1800000000',
  logIndex: '0',
};

const overlay: PendingActivity = {
  requestId: REQUEST,
  txHash: TX,
  outcome: 'REFUSED',
  rule: 'CUMULATIVE_CAP',
  mandateId: '1',
  recipient: '0x000000000000000000000000000000000000bEEF',
  attempted: '70000000',
  transferred: '0',
  headroom: '60000000',
  spentAfter: '40000000',
  confirmedAt: 1,
};

describe('on-chain to indexed transition', () => {
  it('shows a confirmed overlay while the record is not indexed', () => {
    const entries = mergeTimeline([], [overlay]);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe('pending');
  });

  it('replaces the overlay with the indexed record instead of duplicating the event', () => {
    const entries = mergeTimeline([indexedRefusal], [overlay]);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe('indexed');
  });

  it('matches an overlay on request ID and transaction hash regardless of case', () => {
    const upper: PendingActivity = {
      ...overlay,
      requestId: REQUEST.toUpperCase(),
      txHash: TX.toUpperCase(),
    };
    expect(mergeTimeline([indexedRefusal], [upper])).toHaveLength(1);
    expect(isIndexed({ records: [indexedRefusal] } as never, upper)).toBe(true);
  });

  it('keeps an unrelated overlay beside the indexed history', () => {
    const other: PendingActivity = {
      ...overlay,
      requestId: `0x${'02'.repeat(32)}`,
      txHash: `0x${'ef'.repeat(32)}`,
      outcome: 'EXECUTED',
      rule: 'NONE',
    };
    const entries = mergeTimeline([indexedRefusal], [other]);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.kind).toBe('pending');
    expect(filterTimeline(entries, 'REFUSED')).toHaveLength(1);
    expect(filterTimeline(entries, 'EXECUTED')).toHaveLength(1);
    expect(filterTimeline(entries, 'ALL')).toHaveLength(2);
  });

  it('never lists the same indexed action twice', () => {
    expect(mergeTimeline([indexedRefusal, indexedRefusal], [])).toHaveLength(1);
  });
});
