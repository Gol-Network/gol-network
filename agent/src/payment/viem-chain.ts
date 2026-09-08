import { ARC_TESTNET_CHAIN_ID, golAccountAbi, type Address, type Hex32 } from '@gol/protocol';
import { createPublicClient, defineChain, http, type PublicClient } from 'viem';
import type { ConfirmedReceipt, PaymentChain, StoredRequest } from './types.js';

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  testnet: true,
});

export class ViemPaymentChain implements PaymentChain {
  readonly #client: PublicClient;

  constructor(rpcUrl: string) {
    if (!rpcUrl.startsWith('https://')) throw new Error('Arc RPC URL must use HTTPS');
    this.#client = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
  }

  async waitForReceipt(txHash: Hex32): Promise<ConfirmedReceipt> {
    const receipt = await this.#client.waitForTransactionReceipt({
      hash: txHash,
      pollingInterval: 2_000,
      timeout: 60_000,
    });
    return {
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      status: receipt.status,
      from: receipt.from,
      to: receipt.to,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        logIndex: log.logIndex,
      })),
    };
  }

  async readRequest(account: Address, mandateId: bigint, requestId: Hex32): Promise<StoredRequest> {
    const record = await this.#client.readContract({
      address: account,
      abi: golAccountAbi,
      functionName: 'getRequest',
      args: [mandateId, requestId],
    });
    return {
      agent: record.agent,
      recipient: record.recipient,
      attempted: record.attempted,
      headroom: record.headroom,
      spentAfter: record.spentAfter,
      outcome: record.outcome,
      rule: record.rule,
      reason: record.reason,
    };
  }
}
