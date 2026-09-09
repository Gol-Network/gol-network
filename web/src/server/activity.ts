import 'server-only';

import {
  HttpGraphTransport,
  getActivity,
  getAnswerEvidence,
  type ChainHeadSource,
  type GraphTransport,
} from '@gol/agent/query';
import {
  ARC_TESTNET_CHAIN_ID,
  addressSchema,
  type ActivityFilter,
  type ActivityPage,
} from '@gol/protocol';
import { createPublicClient, defineChain, http } from 'viem';
import { runtimeConfig } from './env';

const unavailable = {
  graph: { request: async () => Promise.reject(new Error('Graph unavailable')) } as GraphTransport,
  chain: { getHead: async () => Promise.reject(new Error('RPC unavailable')) } as ChainHeadSource,
};

function sources(): { graph: GraphTransport; chain: ChainHeadSource } {
  const { public: publicConfig, server } = runtimeConfig();
  if (!server.graphQueryUrl) return unavailable;
  const chain = defineChain({
    id: ARC_TESTNET_CHAIN_ID,
    name: publicConfig.chainName,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [publicConfig.rpcUrl] } },
    testnet: true,
  });
  const client = createPublicClient({ chain, transport: http(publicConfig.rpcUrl) });
  return {
    graph: new HttpGraphTransport(server.graphQueryUrl, server.graphApiKey ?? undefined),
    chain: {
      getHead: async () => {
        const block = await client.getBlock({ blockTag: 'latest' });
        return { number: block.number, timestamp: block.timestamp };
      },
    },
  };
}

/** Timeline page. The account scope always comes from server code, never from the client. */
export async function activityFor(
  accountValue: string,
  filter: ActivityFilter,
): Promise<ActivityPage> {
  const account = addressSchema.parse(accountValue);
  const { graph, chain } = sources();
  return getActivity({ chainId: ARC_TESTNET_CHAIN_ID, account }, filter, graph, chain);
}

/** Bounded evidence set a grounded answer may cite. */
export async function evidenceFor(accountValue: string): Promise<ActivityPage> {
  const account = addressSchema.parse(accountValue);
  const { graph, chain } = sources();
  return getAnswerEvidence({ chainId: ARC_TESTNET_CHAIN_ID, account }, {}, graph, chain);
}
