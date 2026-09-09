import type { Address, Hex32 } from '@gol/protocol';

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

export interface PaymentChain {
  waitForReceipt(txHash: Hex32): Promise<ConfirmedReceipt>;
  readRequest(account: Address, mandateId: bigint, requestId: Hex32): Promise<StoredRequest>;
}

export class SignerPolicyError extends Error {
  readonly code = 'SIGNER_BLOCKED';
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
