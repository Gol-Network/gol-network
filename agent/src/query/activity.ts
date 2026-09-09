import {
  ACTIVITY_PAGE_MAX,
  ANSWER_RECORD_MAX,
  ARC_TESTNET_CHAIN_ID,
  REFUSAL_RULES,
  type AccountScope,
  type ActivityFilter,
  type ActivityPage,
  type ActivityRecord,
  type Address,
  type Hex32,
} from '@gol/protocol';
import { z } from 'zod';

const MAX_SEQUENCE = '340282366920938463463374607431768211455';

const ACTION_FIELDS = `id requestId account { id } mandate { id mandateId cumulativeCap }
    agent recipient outcome rule reason attempted transferred headroom spentAfter sequence
    transactionHash blockNumber blockHash timestamp logIndex`;

const META_FIELDS = `_meta { block { number hash timestamp } hasIndexingErrors deployment }`;

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

const hexId = z.string().regex(/^0x[0-9a-fA-F]+$/);
const hash32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const units = z.string().regex(/^(0|[1-9][0-9]*)$/);

const rawActionSchema = z.object({
  id: hexId,
  requestId: hash32,
  account: z.object({ id: address }),
  mandate: z.object({ id: z.string().min(1), mandateId: units, cumulativeCap: units }),
  agent: address,
  recipient: address,
  outcome: z.enum(['EXECUTED', 'REFUSED']),
  rule: z.enum(REFUSAL_RULES),
  reason: z.string().max(200),
  attempted: units,
  transferred: units,
  headroom: units,
  spentAfter: units,
  sequence: units,
  transactionHash: hash32,
  blockNumber: units,
  blockHash: hash32,
  timestamp: units,
  logIndex: units,
});

const responseSchema = z.object({
  errors: z.array(z.unknown()).optional(),
  data: z
    .object({
      actions: z.array(rawActionSchema),
      _meta: z.object({
        block: z.object({
          number: z.number().int().nonnegative(),
          hash: hash32.nullable().optional(),
          timestamp: z.number().int().nonnegative().nullable().optional(),
        }),
        hasIndexingErrors: z.boolean().nullable().optional(),
        deployment: z.string().min(1).nullable().optional(),
      }),
    })
    .optional(),
});

type RawAction = z.infer<typeof rawActionSchema>;
type GraphMeta = NonNullable<z.infer<typeof responseSchema>['data']>['_meta'];

class GraphIntegrityError extends Error {
  readonly code = 'INTEGRITY_MISMATCH';
}

/**
 * Builds one scoped GraphQL document. Every filter is applied in the `where` clause before
 * pagination, so a page is never fetched and then discarded client-side.
 */
export function buildActivityQuery(
  scope: AccountScope,
  filter: ActivityFilter,
): { query: string; variables: Record<string, unknown> } {
  const first = Math.min(Math.max(Math.trunc(filter.first), 1), ACTIVITY_PAGE_MAX);
  const declarations = ['$account: Bytes!', '$first: Int!', '$before: BigInt!'];
  const clauses = ['account: $account', 'sequence_lt: $before'];
  const variables: Record<string, unknown> = {
    account: scope.account.toLowerCase(),
    first,
    before: filter.cursor ?? MAX_SEQUENCE,
  };

  if (filter.outcome) {
    declarations.push('$outcome: String!');
    clauses.push('outcome: $outcome');
    variables.outcome = filter.outcome;
  }
  if (filter.rule) {
    declarations.push('$rule: String!');
    clauses.push('rule: $rule');
    variables.rule = filter.rule;
  }
  const mandateId = filter.mandateId ?? scope.mandateId;
  if (mandateId) {
    declarations.push('$mandate: String!');
    clauses.push('mandate: $mandate');
    variables.mandate = `${scope.account.toLowerCase()}:${mandateId}`;
  }
  if (scope.agent) {
    declarations.push('$agent: Bytes!');
    clauses.push('agent: $agent');
    variables.agent = scope.agent.toLowerCase();
  }
  if (filter.fromTimestamp) {
    declarations.push('$fromTimestamp: BigInt!');
    clauses.push('timestamp_gte: $fromTimestamp');
    variables.fromTimestamp = filter.fromTimestamp;
  }
  if (filter.toTimestamp) {
    declarations.push('$toTimestamp: BigInt!');
    clauses.push('timestamp_lte: $toTimestamp');
    variables.toTimestamp = filter.toTimestamp;
  }

  const query = `query Activity(${declarations.join(', ')}) {
  actions(first: $first, orderBy: sequence, orderDirection: desc,
    where: { ${clauses.join(', ')} }) {
    ${ACTION_FIELDS}
  }
  ${META_FIELDS}
}`;
  return { query, variables };
}

export async function getActivity(
  scope: AccountScope,
  filter: ActivityFilter,
  graph: GraphTransport,
  chain: ChainHeadSource,
): Promise<ActivityPage> {
  if (scope.chainId !== ARC_TESTNET_CHAIN_ID) throw new Error('Wrong chain');
  const first = Math.min(Math.max(Math.trunc(filter.first), 1), ACTIVITY_PAGE_MAX);
  try {
    const { records, meta, head } = await fetchPage(scope, { ...filter, first }, graph, chain);
    return page(records, meta, head, {
      cursor: records.length === first ? (records.at(-1)?.sequence ?? null) : null,
      partial: records.length === first,
    });
  } catch (error) {
    return unavailablePage(error instanceof GraphIntegrityError);
  }
}

/**
 * Loads the evidence a grounded answer may cite. It follows the deterministic sequence cursor over
 * multiple pages but stops at {@link ANSWER_RECORD_MAX} scoped records and reports truncation.
 */
export async function getAnswerEvidence(
  scope: AccountScope,
  filter: Omit<ActivityFilter, 'first' | 'cursor'>,
  graph: GraphTransport,
  chain: ChainHeadSource,
): Promise<ActivityPage> {
  if (scope.chainId !== ARC_TESTNET_CHAIN_ID) throw new Error('Wrong chain');
  const collected: ActivityRecord[] = [];
  let cursor: string | undefined;
  let meta: GraphMeta | null = null;
  let head: { number: bigint; timestamp: bigint } | null = null;
  let truncated = false;

  try {
    for (let request = 0; request < 4; request += 1) {
      const remaining = ANSWER_RECORD_MAX - collected.length;
      if (remaining <= 0) break;
      const size = Math.min(remaining, ACTIVITY_PAGE_MAX);
      const result = await fetchPage(
        scope,
        { ...filter, first: size, ...(cursor ? { cursor } : {}) },
        graph,
        chain,
      );
      meta = result.meta;
      head = result.head;
      collected.push(...result.records);
      if (result.records.length < size) break;
      cursor = result.records.at(-1)?.sequence;
      if (!cursor) break;
      if (collected.length >= ANSWER_RECORD_MAX) {
        truncated = true;
        break;
      }
    }
    if (!meta || !head) throw new Error('Graph response is incomplete');
    return page(collected.slice(0, ANSWER_RECORD_MAX), meta, head, {
      cursor: truncated ? (cursor ?? null) : null,
      partial: truncated,
    });
  } catch (error) {
    return unavailablePage(error instanceof GraphIntegrityError);
  }
}

async function fetchPage(
  scope: AccountScope,
  filter: ActivityFilter,
  graph: GraphTransport,
  chain: ChainHeadSource,
): Promise<{
  records: ActivityRecord[];
  meta: GraphMeta;
  head: { number: bigint; timestamp: bigint };
}> {
  const [raw, head] = await Promise.all([
    graph.request(buildActivityQuery(scope, filter)),
    chain.getHead(),
  ]);
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) throw new GraphIntegrityError('Graph response failed validation');
  if (parsed.data.errors?.length) throw new Error('Graph response reported errors');
  if (!parsed.data.data) throw new Error('Graph response is incomplete');
  const { actions, _meta } = parsed.data.data;
  for (const action of actions) {
    if (action.account.id.toLowerCase() !== scope.account.toLowerCase()) {
      throw new GraphIntegrityError('Graph returned an out-of-scope account');
    }
    if (action.outcome === 'EXECUTED' && action.transferred !== action.attempted) {
      throw new GraphIntegrityError('Executed record transferred an unexpected amount');
    }
    if (action.outcome === 'REFUSED' && action.transferred !== '0') {
      throw new GraphIntegrityError('Refused record transferred a non-zero amount');
    }
  }
  return { records: actions.map(toActivityRecord), meta: _meta, head };
}

function page(
  records: ActivityRecord[],
  meta: GraphMeta,
  head: { number: bigint; timestamp: bigint },
  pagination: { cursor: string | null; partial: boolean },
): ActivityPage {
  const indexedTimestamp = BigInt(meta.block.timestamp ?? 0);
  const lag = head.timestamp > indexedTimestamp ? head.timestamp - indexedTimestamp : 0n;
  const hasErrors = meta.hasIndexingErrors ?? null;
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
    cursor: pagination.cursor,
    indexedBlock: String(meta.block.number),
    indexedBlockHash: (meta.block.hash as Hex32 | undefined) ?? null,
    indexedAt: indexedTimestamp === 0n ? null : indexedTimestamp.toString(),
    chainHeadBlock: head.number.toString(),
    hasIndexingErrors: hasErrors,
    freshness,
    sourceDeployment: meta.deployment ?? null,
    partial: pagination.partial,
  };
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

function unavailablePage(integrityMismatch: boolean): ActivityPage {
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
    ...(integrityMismatch ? { integrityMismatch: true } : {}),
  };
}
