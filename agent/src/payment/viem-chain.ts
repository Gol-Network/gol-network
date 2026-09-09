import {
  ARC_TESTNET_CHAIN_ID,
  golAccountAbi,
  type Address,
  type Hex,
  type Hex32,
} from '@gol/protocol';
import { createPublicClient, defineChain, http, keccak256, type PublicClient } from 'viem';
import {
  BroadcastAmbiguousError,
  NonceTooLowError,
  type BroadcastResult,
  type ConfirmedReceipt,
  type FeeParameters,
  type PaymentChain,
  type StoredMandate,
  type StoredRequest,
} from './types.js';

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  testnet: true,
});

const ALREADY_KNOWN = [
  'already known',
  'already imported',
  'known transaction',
  'alreadyknown',
  'transaction already exists',
  'duplicate transaction',
];
const NONCE_TOO_LOW = ['nonce too low', 'nonce is too low', 'oldnonce', 'invalid nonce'];

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
    return toConfirmedReceipt(receipt);
  }

  async getReceiptIfPresent(txHash: Hex32): Promise<ConfirmedReceipt | null> {
    try {
      const receipt = await this.#client.getTransactionReceipt({ hash: txHash });
      return toConfirmedReceipt(receipt);
    } catch {
      return null;
    }
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

  async readActiveMandateId(account: Address): Promise<bigint> {
    return this.#client.readContract({
      address: account,
      abi: golAccountAbi,
      functionName: 'activeMandateId',
    });
  }

  async readMandate(account: Address, mandateId: bigint): Promise<StoredMandate> {
    const mandate = await this.#client.readContract({
      address: account,
      abi: golAccountAbi,
      functionName: 'getMandate',
      args: [mandateId],
    });
    return {
      agent: mandate.agent,
      perPaymentCap: mandate.perPaymentCap,
      cumulativeCap: mandate.cumulativeCap,
      spent: mandate.spent,
      expiresAt: mandate.expiresAt,
      revoked: mandate.revoked,
      exists: mandate.exists,
    };
  }

  async nativeBalance(address: Address): Promise<bigint> {
    return this.#client.getBalance({ address });
  }

  async pendingNonce(address: Address): Promise<number> {
    return this.#client.getTransactionCount({ address, blockTag: 'pending' });
  }

  async latestNonce(address: Address): Promise<number> {
    return this.#client.getTransactionCount({ address, blockTag: 'latest' });
  }

  async feeParameters(): Promise<FeeParameters> {
    const fees = await this.#client.estimateFeesPerGas();
    return {
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    };
  }

  async estimatePayGas(input: { from: Address; to: Address; data: Hex }): Promise<bigint> {
    return this.#client.estimateGas({
      account: input.from,
      to: input.to,
      data: input.data,
      value: 0n,
    });
  }

  async broadcastRawTransaction(rawTransaction: Hex): Promise<BroadcastResult> {
    const txHash = keccak256(rawTransaction) as Hex32;
    try {
      const returned = await this.#client.sendRawTransaction({
        serializedTransaction: rawTransaction,
      });
      // Trust the locally computed hash; only assert the RPC agrees when it answers at all.
      if (returned && returned.toLowerCase() !== txHash.toLowerCase()) {
        throw new BroadcastAmbiguousError('RPC returned a different transaction hash');
      }
      return { txHash, status: 'accepted' };
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (ALREADY_KNOWN.some((needle) => message.includes(needle))) {
        return { txHash, status: 'already-known' };
      }
      if (NONCE_TOO_LOW.some((needle) => message.includes(needle))) {
        throw new NonceTooLowError('eth_sendRawTransaction reported nonce too low');
      }
      if (error instanceof BroadcastAmbiguousError) throw error;
      throw new BroadcastAmbiguousError('eth_sendRawTransaction outcome is unresolved');
    }
  }
}

function toConfirmedReceipt(receipt: {
  transactionHash: Hex32;
  blockNumber: bigint;
  blockHash: Hex32;
  status: 'success' | 'reverted';
  from: Address;
  to: Address | null;
  logs: readonly {
    address: Address;
    topics: readonly `0x${string}`[];
    data: `0x${string}`;
    logIndex: number;
  }[];
}): ConfirmedReceipt {
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
