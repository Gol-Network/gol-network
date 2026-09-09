import type { Address, Hex, Hex32 } from '@gol/protocol';

export interface TransactionRequest {
  chainId: 5042002;
  to: Address;
  value: 0n;
  data: `0x${string}`;
  referenceId?: string;
}

export interface Submission {
  txHash: Hex32;
  providerOperationId: string | null;
}

export interface ScopedAgentSigner {
  sendTransaction(request: TransactionRequest): Promise<Submission>;
  getSubmission(providerOperationId: string): Promise<Submission | null>;
}

export interface ConfirmedReceipt {
  transactionHash: Hex32;
  blockNumber: bigint;
  blockHash: Hex32;
  status: 'success' | 'reverted';
  from: Address;
  to: Address | null;
  logs: Array<{
    address: Address;
    topics: readonly `0x${string}`[];
    data: `0x${string}`;
    logIndex: number;
  }>;
}

export interface StoredRequest {
  agent: Address;
  recipient: Address;
  attempted: bigint;
  headroom: bigint;
  spentAfter: bigint;
  outcome: number;
  rule: number;
  reason: string;
}

export interface FeeParameters {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

export interface BroadcastResult {
  /** Locally computed `keccak256(rawTransaction)`; never taken from the RPC response. */
  txHash: Hex32;
  /** `already-known` means the RPC has these exact bytes; treat it as an accepted rebroadcast. */
  status: 'accepted' | 'already-known';
}

export interface StoredMandate {
  agent: Address;
  perPaymentCap: bigint;
  cumulativeCap: bigint;
  spent: bigint;
  expiresAt: bigint;
  revoked: boolean;
  exists: boolean;
}

export interface PaymentChain {
  waitForReceipt(txHash: Hex32): Promise<ConfirmedReceipt>;
  readRequest(account: Address, mandateId: bigint, requestId: Hex32): Promise<StoredRequest>;
  /** Current `activeMandateId` on the account, read immediately before signing. */
  readActiveMandateId(account: Address): Promise<bigint>;
  /** Full mandate record, used to confirm the live mandate names the agent and is still active. */
  readMandate(account: Address, mandateId: bigint): Promise<StoredMandate>;
  /** Native Arc balance for the signer, used to refuse before signing when gas is insufficient. */
  nativeBalance(address: Address): Promise<bigint>;
  /** Pending transaction count for the signer, read inside the nonce advisory lock. */
  pendingNonce(address: Address): Promise<number>;
  /** Latest (mined) transaction count for the signer, used for `nonce too low` reconciliation. */
  latestNonce(address: Address): Promise<number>;
  /** Fee parameters derived from Arc RPC. The worker bounds these by configured ceilings. */
  feeParameters(): Promise<FeeParameters>;
  /** Bounded gas estimate for a `GolAccount.pay` call from the agent address. */
  estimatePayGas(input: { from: Address; to: Address; data: Hex }): Promise<bigint>;
  /** Broadcasts the exact serialized bytes. Rebroadcasting identical bytes is always safe. */
  broadcastRawTransaction(rawTransaction: Hex): Promise<BroadcastResult>;
  /** Returns a receipt only if one already exists; never waits. Used during recovery. */
  getReceiptIfPresent(txHash: Hex32): Promise<ConfirmedReceipt | null>;
}

export class SignerPolicyError extends Error {
  readonly code = 'SIGNER_BLOCKED';
}

/** `eth_sendRawTransaction` reported the nonce as already mined. Never re-sign automatically. */
export class NonceTooLowError extends Error {
  readonly code = 'NONCE_TOO_LOW';
}

/** The broadcast outcome is unresolved. The identical bytes may be rebroadcast when safe. */
export class BroadcastAmbiguousError extends Error {
  readonly code = 'BROADCAST_AMBIGUOUS';
}

export class SignerConfigurationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SignerConfigurationError';
    this.code = code;
  }
}

export class PaymentIntegrityError extends Error {
  readonly code = 'INTEGRITY_MISMATCH';
}
