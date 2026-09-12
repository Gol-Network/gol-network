import 'server-only';

import {
  HttpGraphTransport,
  getActivity,
  getAnswerEvidence,
  type ChainHeadSource,
  type GraphTransport,
} from '@gol/agent/query';
import {
  ARC_TESTNET_USDC,
  ARC_TESTNET_CHAIN_ID,
  addressSchema,
  erc20Abi,
  golAccountAbi,
  golAccountFactoryAbi,
  type ActivityFilter,
  type ActivityPage,
  type Address,
  type Hex,
  type Hex32,
  type LifecycleEventRecord,
} from '@gol/protocol';
import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  http,
  toFunctionSelector,
  type Log,
  type PublicClient,
} from 'viem';
import { z } from 'zod';
import { runtimeConfig } from './env';

const LIFECYCLE_CACHE_MS = 10_000;
const ARCSCAN_API = 'https://api-testnet.arc-scan.org/v1';
const hash32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const legacyAccountSchema = z.object({
  data: z.object({
    account: z
      .object({
        createdAtBlock: z.string().regex(/^[0-9]+$/),
        createdAt: z.string().regex(/^[0-9]+$/),
      })
      .nullable(),
  }),
});
const arcscanActivitySchema = z.object({
  items: z.array(
    z.object({
      kind: z.string(),
      block: z.number().int().nonnegative(),
      timestamp: z.number().int().nonnegative(),
      tx_hash: hash32Schema,
      direction: z.string(),
      to: z.object({ address: addressSchema }),
      token: z.object({ address: addressSchema }).nullable(),
    }),
  ),
});
const arcscanTransactionsSchema = z.object({
  items: z.array(
    z.object({
      hash: hash32Schema,
      block: z.number().int().nonnegative(),
      timestamp: z.number().int().nonnegative(),
      status: z.string(),
      method: z.object({ selector: z.string().regex(/^0x[0-9a-fA-F]{8}$/) }),
    }),
  ),
});
const ownerActionSelectors = new Set<Hex>([
  toFunctionSelector('createMandate(address,uint256,uint256,uint64,address[])'),
  toFunctionSelector('revokeMandate(uint256)'),
  toFunctionSelector('withdraw(uint256)'),
]);
const lifecycleCache = new Map<string, { expiresAt: number; records: LifecycleEventRecord[] }>();

const unavailable = {
  graph: { request: async () => Promise.reject(new Error('Graph unavailable')) } as GraphTransport,
  chain: { getHead: async () => Promise.reject(new Error('RPC unavailable')) } as ChainHeadSource,
};

function sources(): { graph: GraphTransport; chain: ChainHeadSource; client: PublicClient } {
  const { public: publicConfig, server } = runtimeConfig();
  const chain = defineChain({
    id: ARC_TESTNET_CHAIN_ID,
    name: publicConfig.chainName,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [publicConfig.rpcUrl] } },
    testnet: true,
  });
  const client = createPublicClient({ chain, transport: http(publicConfig.rpcUrl) });
  return {
    graph: server.graphQueryUrl
      ? new HttpGraphTransport(server.graphQueryUrl, server.graphApiKey ?? undefined)
      : unavailable.graph,
    chain: {
      getHead: async () => {
        const block = await client.getBlock({ blockTag: 'latest' });
        return { number: block.number, timestamp: block.timestamp };
      },
    },
    client: client as PublicClient,
  };
}

/** Timeline page. The account scope always comes from server code, never from the client. */
export async function activityFor(
  accountValue: string,
  filter: ActivityFilter,
): Promise<ActivityPage> {
  const account = addressSchema.parse(accountValue);
  const { public: publicConfig } = runtimeConfig();
  const { graph, chain, client } = sources();
  const page = await getActivity({ chainId: ARC_TESTNET_CHAIN_ID, account }, filter, graph, chain);
  if (page.lifecycleEvents?.length || !publicConfig.factoryAddress) return page;

  const lifecycleEvents = await lifecycleFromChain(
    client,
    graph,
    publicConfig.factoryAddress,
    account,
  ).catch(() => []);
  return { ...page, lifecycleEvents };
}

/** Bounded evidence set a grounded answer may cite. */
export async function evidenceFor(accountValue: string): Promise<ActivityPage> {
  const account = addressSchema.parse(accountValue);
  const { graph, chain } = sources();
  return getAnswerEvidence({ chainId: ARC_TESTNET_CHAIN_ID, account }, {}, graph, chain);
}

async function lifecycleFromChain(
  client: PublicClient,
  graph: GraphTransport,
  factory: Address,
  account: Address,
): Promise<LifecycleEventRecord[]> {
  const cacheKey = `${factory.toLowerCase()}:${account.toLowerCase()}`;
  const cached = lifecycleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.records;

  const [creation, activity, transactions] = await Promise.all([
    legacyAccountCreation(graph, account),
    arcscanActivity(account),
    arcscanTransactions(account),
  ]);
  if (!creation) return [];

  const creationLogs = await client.getLogs({
    address: factory,
    event: golAccountFactoryAbi[3],
    args: { account },
    fromBlock: creation.blockNumber,
    toBlock: creation.blockNumber,
  });
  const transactionTimestamps = new Map<Hex32, bigint>();
  const selectedHashes = new Set<Hex32>();
  for (const log of creationLogs) {
    if (!log.transactionHash) continue;
    const hash = log.transactionHash as Hex32;
    selectedHashes.add(hash);
    transactionTimestamps.set(hash, creation.timestamp);
  }
  for (const item of activity.items) {
    if (
      item.kind !== 'token' ||
      item.direction !== 'in' ||
      item.to.address.toLowerCase() !== account.toLowerCase() ||
      item.token?.address.toLowerCase() !== ARC_TESTNET_USDC.toLowerCase()
    ) {
      continue;
    }
    const hash = item.tx_hash as Hex32;
    selectedHashes.add(hash);
    transactionTimestamps.set(hash, BigInt(item.timestamp));
  }
  for (const transaction of transactions.items) {
    if (
      transaction.status !== 'success' ||
      !ownerActionSelectors.has(transaction.method.selector as Hex)
    ) {
      continue;
    }
    const hash = transaction.hash as Hex32;
    selectedHashes.add(hash);
    transactionTimestamps.set(hash, BigInt(transaction.timestamp));
  }

  const receipts = await Promise.all(
    [...selectedHashes].map((hash) => client.getTransactionReceipt({ hash })),
  );
  const records = receipts
    .flatMap((receipt) =>
      receipt.logs.flatMap((log) =>
        lifecycleRecord(log, account, {
          timestamp: transactionTimestamps.get(receipt.transactionHash as Hex32) ?? 0n,
        }),
      ),
    )
    .filter((record) => record.timestamp !== '0')
    .sort((left, right) => Number(BigInt(right.timestamp) - BigInt(left.timestamp)));
  lifecycleCache.set(cacheKey, { expiresAt: Date.now() + LIFECYCLE_CACHE_MS, records });
  return records;
}

async function legacyAccountCreation(
  graph: GraphTransport,
  account: Address,
): Promise<{ blockNumber: bigint; timestamp: bigint } | null> {
  const raw = await graph.request({
    query: `query LegacyAccount($account: Bytes!) {
  account(id: $account) { createdAtBlock createdAt }
}`,
    variables: { account: account.toLowerCase() },
  });
  const parsed = legacyAccountSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.data.account) return null;
  return {
    blockNumber: BigInt(parsed.data.data.account.createdAtBlock),
    timestamp: BigInt(parsed.data.data.account.createdAt),
  };
}

async function arcscanActivity(account: Address) {
  const response = await fetch(`${ARCSCAN_API}/address/${account}/activity?limit=100`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Arcscan activity failed with ${response.status}`);
  return arcscanActivitySchema.parse(await response.json());
}

async function arcscanTransactions(account: Address) {
  const response = await fetch(`${ARCSCAN_API}/address/${account}/txs?limit=100`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Arcscan transactions failed with ${response.status}`);
  return arcscanTransactionsSchema.parse(await response.json());
}

function lifecycleRecord(
  log: Log,
  account: Address,
  block: { timestamp: bigint } | undefined,
): LifecycleEventRecord[] {
  if (
    !log.transactionHash ||
    !log.blockHash ||
    log.blockNumber === null ||
    log.logIndex === null ||
    !block
  ) {
    return [];
  }
  const base = {
    eventId: `${log.transactionHash}${log.logIndex.toString(16).padStart(8, '0')}` as Hex,
    account,
    amountUnits: null,
    mandateId: null,
    agent: null,
    transactionHash: log.transactionHash as Hex32,
    blockNumber: log.blockNumber.toString(),
    blockHash: log.blockHash as Hex32,
    timestamp: block.timestamp.toString(),
    logIndex: log.logIndex.toString(),
  };

  try {
    if (log.address.toLowerCase() === ARC_TESTNET_USDC.toLowerCase()) {
      const decoded = decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics });
      if (
        decoded.eventName !== 'Transfer' ||
        decoded.args.to.toLowerCase() !== account.toLowerCase()
      ) {
        return [];
      }
      return [
        {
          ...base,
          kind: 'FUNDS_ADDED',
          amountUnits: decoded.args.value.toString(),
        },
      ];
    }
    const decoded = decodeEventLog({
      abi: [...golAccountFactoryAbi, ...golAccountAbi],
      data: log.data,
      topics: log.topics,
    });
    if (decoded.eventName === 'AccountCreated') {
      return [{ ...base, kind: 'ACCOUNT_CREATED' }];
    }
    if (decoded.eventName === 'MandateCreated') {
      return [
        {
          ...base,
          kind: 'MANDATE_CREATED',
          mandateId: decoded.args.mandateId.toString(),
          agent: decoded.args.agent,
        },
      ];
    }
    if (decoded.eventName === 'MandateRevoked') {
      return [
        {
          ...base,
          kind: 'MANDATE_REVOKED',
          mandateId: decoded.args.mandateId.toString(),
          agent: decoded.args.agent,
        },
      ];
    }
    if (decoded.eventName === 'Withdrawn') {
      return [{ ...base, kind: 'FUNDS_WITHDRAWN', amountUnits: decoded.args.amount.toString() }];
    }
  } catch {
    // Executed and Refused belong to the payment timeline; unknown logs are ignored.
  }
  return [];
}
