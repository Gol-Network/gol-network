import 'server-only';

import { HttpGraphTransport, getActivity } from '@gol/agent/query';
import { ARC_TESTNET_CHAIN_ID, addressSchema, type ActivityFilter } from '@gol/protocol';
import { createPublicClient, defineChain, http } from 'viem';

export async function activityFor(accountValue: string, filter: ActivityFilter) {
  const account = addressSchema.parse(accountValue);
  const rpcUrl = process.env.ARC_RPC_URL;
  const graphUrl = process.env.GRAPH_QUERY_URL;
  if (!rpcUrl || !graphUrl) {
    return getActivity(
      { chainId: ARC_TESTNET_CHAIN_ID, account },
      filter,
      { request: async () => Promise.reject(new Error('Graph unavailable')) },
      { getHead: async () => Promise.reject(new Error('RPC unavailable')) },
    );
  }
  const chain = defineChain({
    id: ARC_TESTNET_CHAIN_ID,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    testnet: true,
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  return getActivity(
    { chainId: ARC_TESTNET_CHAIN_ID, account },
    filter,
    new HttpGraphTransport(graphUrl, process.env.GRAPH_API_KEY),
    {
      getHead: async () => {
        const block = await client.getBlock({ blockTag: 'latest' });
        return { number: block.number, timestamp: block.timestamp };
      },
    },
  );
}
