import type { ActivityPage, ActivityRecord } from '@gol/protocol';

/**
 * A confirmed on-chain outcome that The Graph has not indexed yet. It is created from the
 * transaction receipt, never from a simulation, and it is replaced — not duplicated — once the
 * matching indexed record arrives.
 */
export interface PendingActivity {
  requestId: string;
  txHash: string;
  outcome: 'EXECUTED' | 'REFUSED';
  rule: string;
  mandateId: string;
  recipient: string;
  attempted: string;
  transferred: string;
  headroom: string;
  spentAfter: string;
  confirmedAt: number;
}

export type TimelineEntry =
  | { kind: 'indexed'; key: string; record: ActivityRecord }
  | { kind: 'pending'; key: string; pending: PendingActivity };

export type TimelineFilter = 'ALL' | 'EXECUTED' | 'REFUSED';

function lower(value: string): string {
  return value.toLowerCase();
}

/**
 * Combines indexed records with confirmed overlays. One business event is displayed once: an
 * overlay whose request ID or transaction hash is already indexed is dropped.
 */
export function mergeTimeline(
  records: readonly ActivityRecord[],
  pending: readonly PendingActivity[],
): TimelineEntry[] {
  const seenActions = new Set<string>();
  const indexed: TimelineEntry[] = [];
  const indexedRequests = new Set<string>();
  const indexedTransactions = new Set<string>();

  for (const record of records) {
    const key = lower(record.actionId);
    if (seenActions.has(key)) continue;
    seenActions.add(key);
    indexedRequests.add(lower(record.requestId));
    indexedTransactions.add(lower(record.transactionHash));
    indexed.push({ kind: 'indexed', key, record });
  }

  const overlays: TimelineEntry[] = [];
  const seenPending = new Set<string>();
  for (const entry of pending) {
    const key = lower(entry.requestId);
    if (seenPending.has(key)) continue;
    seenPending.add(key);
    if (indexedRequests.has(key) || indexedTransactions.has(lower(entry.txHash))) continue;
    overlays.push({ kind: 'pending', key: `pending:${key}`, pending: entry });
  }

  return [...overlays, ...indexed];
}

export function filterTimeline(
  entries: readonly TimelineEntry[],
  filter: TimelineFilter,
): TimelineEntry[] {
  if (filter === 'ALL') return [...entries];
  return entries.filter((entry) =>
    entry.kind === 'indexed' ? entry.record.outcome === filter : entry.pending.outcome === filter,
  );
}

export function isIndexed(page: ActivityPage | null, entry: PendingActivity): boolean {
  if (!page) return false;
  return page.records.some(
    (record) =>
      lower(record.requestId) === lower(entry.requestId) &&
      lower(record.transactionHash) === lower(entry.txHash),
  );
}

/** Bounded backoff for the automatic indexing window, in milliseconds. */
export const INDEXING_BACKOFF_MS = [3_000, 5_000, 8_000, 13_000, 21_000, 30_000, 30_000, 30_000];
