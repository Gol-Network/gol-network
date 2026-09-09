import 'server-only';

import { ARC_TESTNET_CHAIN_ID } from '@gol/protocol';
import { createPublicClient, defineChain, http, type PublicClient } from 'viem';
import { runtimeConfig } from './env';

export function arcChain() {
  const { public: publicConfig } = runtimeConfig();
  return defineChain({
    id: ARC_TESTNET_CHAIN_ID,
    name: publicConfig.chainName,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [publicConfig.rpcUrl] } },
    blockExplorers: { default: { name: 'Arc Explorer', url: publicConfig.explorerUrl } },
    testnet: true,
  });
}

export function arcClient(): PublicClient {
  const { public: publicConfig } = runtimeConfig();
  return createPublicClient({
    chain: arcChain(),
    transport: http(publicConfig.rpcUrl),
  }) as PublicClient;
}

/** Builds an explorer transaction URL in trusted code from a validated hash. */
export function explorerTransactionUrl(hash: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
  return `${runtimeConfig().public.explorerUrl.replace(/\/$/, '')}/tx/${hash}`;
}
