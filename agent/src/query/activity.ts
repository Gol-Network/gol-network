import {
  ARC_TESTNET_CHAIN_ID,
  type AccountScope,
  type ActivityFilter,
  type ActivityPage,
  type ActivityRecord,
  type Address,
  type Hex32,
} from '@gol/protocol';

const ACTIVITY_QUERY = `query Activity($account: Bytes!, $first: Int!, $before: BigInt!) {
  actions(first: $first, orderBy: sequence, orderDirection: desc,
    where: { account: $account, sequence_lt: $before }) {
    id requestId mandate { mandateId cumulativeCap } agent recipient outcome rule reason
    attempted transferred headroom spentAfter sequence transactionHash blockNumber blockHash timestamp logIndex
  }
  _meta { block { number hash timestamp } hasIndexingErrors deployment }
}`;

export interface GraphTransport {
  request(body: { query: string; variables: Record<string, unknown> }): Promise<unknown>;
}

export interface ChainHeadSource {
  getHead(): Promise<{ number: bigint; timestamp: bigint }>;
}

export class HttpGraphTransport implements GraphTransport {
  constructor(
    private readonly url: string,
    private readonly apiKey?: string,
  ) {
    if (!url.startsWith('https://')) throw new Error('Graph query URL must use HTTPS');
  }

  async request(body: { query: string; variables: Record<string, unknown> }): Promise<unknown> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Graph request failed with ${response.status}`);
    return response.json();
  }
}

interface RawAction {
  id: string;
  requestId: string;
  mandate: { mandateId: string; cumulativeCap: string };
  agent: string;
  recipient: string;
  outcome: 'EXECUTED' | 'REFUSED';
  rule: string;
  reason: string;
  attempted: string;
  transferred: string;
  headroom: string;
  spentAfter: string;
  sequence: string;
  transactionHash: string;
  blockNumber: string;
  blockHash: string;
  timestamp: string;
  logIndex: string;
}

export async function getActivity(
  scope: AccountScope,
  filter: ActivityFilter,
  graph: GraphTransport,
  chain: ChainHeadSource,
): Promise<ActivityPage> {
  if (scope.chainId !== ARC_TESTNET_CHAIN_ID) throw new Error('Wrong chain');
  const first = Math.min(Math.max(filter.first, 1), 50);
  const before = filter.cursor ?? '340282366920938463463374607431768211455';
  try {
    const [raw, head] = await Promise.all([
      graph.request({
        query: ACTIVITY_QUERY,
        variables: { account: scope.account.toLowerCase(), first, before },
      }),
      chain.getHead(),
    ]);
    const response = raw as {
      data?: {
        actions?: RawAction[];
        _meta?: {
          block?: { number: number; hash?: string; timestamp?: number };
          hasIndexingErrors?: boolean;
          deployment?: string;
        };
      };
      errors?: unknown[];
    };
    if (response.errors?.length || !response.data?.actions || !response.data._meta?.block) {
      throw new Error('Graph response is incomplete');
    }
    const records = response.data.actions
      .map(toActivityRecord)
      .filter((record) => matches(record, filter));
    const indexedTimestamp = BigInt(response.data._meta.block.timestamp ?? 0);
    const lag = head.timestamp > indexedTimestamp ? head.timestamp - indexedTimestamp : 0n;
    const hasErrors = response.data._meta.hasIndexingErrors ?? null;
    const freshness =
      hasErrors === true
        ? 'stale'
        : indexedTimestamp === 0n
          ? 'unknown'
          : lag > 60n
            ? 'stale'
            : lag > 15n
              ? 'catching_up'
              : 'current';
    return {
      records,
      cursor: records.length === first ? records.at(-1)!.sequence : null,
      indexedBlock: String(response.data._meta.block.number),
      indexedBlockHash: (response.data._meta.block.hash as Hex32 | undefined) ?? null,
      indexedAt: indexedTimestamp === 0n ? null : indexedTimestamp.toString(),
      chainHeadBlock: head.number.toString(),
      hasIndexingErrors: hasErrors,
      freshness,
      sourceDeployment: response.data._meta.deployment ?? null,
      partial: response.data.actions.length === first,
    };
  } catch {
    return unavailablePage();
  }
}

function toActivityRecord(action: RawAction): ActivityRecord {
  return {
    actionId: action.id as `0x${string}`,
    requestId: action.requestId as Hex32,
    mandateId: action.mandate.mandateId,
    agent: action.agent as Address,
    recipient: action.recipient as Address,
    outcome: action.outcome,
    rule: action.rule,
    reason: action.reason,
    attempted: action.attempted,
    transferred: action.transferred,
    headroom: action.headroom,
    spentAfter: action.spentAfter,
    sequence: action.sequence,
    transactionHash: action.transactionHash as Hex32,
    blockNumber: action.blockNumber,
    blockHash: action.blockHash as Hex32,
    timestamp: action.timestamp,
    logIndex: action.logIndex,
  };
}

function matches(record: ActivityRecord, filter: ActivityFilter): boolean {
  if (filter.outcome && record.outcome !== filter.outcome) return false;
  if (filter.rule && record.rule !== filter.rule) return false;
  if (filter.mandateId && record.mandateId !== filter.mandateId) return false;
  if (filter.fromTimestamp && BigInt(record.timestamp) < BigInt(filter.fromTimestamp)) return false;
  if (filter.toTimestamp && BigInt(record.timestamp) > BigInt(filter.toTimestamp)) return false;
  return true;
}

function unavailablePage(): ActivityPage {
  return {
    records: [],
    cursor: null,
    indexedBlock: null,
    indexedBlockHash: null,
    indexedAt: null,
    chainHeadBlock: null,
    hasIndexingErrors: null,
    freshness: 'unavailable',
    sourceDeployment: null,
    partial: false,
  };
}
