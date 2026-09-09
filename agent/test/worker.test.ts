import {
  ARC_TESTNET_CHAIN_ID,
  type Address,
  type Hex,
  type Hex32,
  type VerifiedAgentContext,
} from '@gol/protocol';
import { keccak256 } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import type { JournalRequest } from '../src/db/journal.js';
import type {
  ConfirmedReceipt,
  PaymentChain,
  ScopedAgentSigner,
  StoredMandate,
  StoredRequest,
  TransactionRequest,
} from '../src/payment/types.js';
import {
  BroadcastAmbiguousError,
  NonceTooLowError,
  SignerConfigurationError,
} from '../src/payment/types.js';
import {
  PaymentWorker,
  type KmsExecutionConfig,
  type WorkerContext,
  type WorkerJournal,
} from '../src/payment/worker.js';
import type { AgentSigner, UnsignedEip1559Transaction } from '../src/signers/index.js';

const ACCOUNT = '0x0000000000000000000000000000000000acc017' as Address;
const AGENT = '0x00000000000000000000000000000000000a6e17' as Address;
const RECIPIENT = '0x000000000000000000000000000000000000beef' as Address;
const REQUEST = `0x${'01'.repeat(32)}` as Hex32;
const TX = `0x${'ab'.repeat(32)}` as Hex32;
const RAW = `0x02${'cc'.repeat(40)}` as Hex;

function job(overrides: Partial<JournalRequest> = {}): JournalRequest {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    userSubject: 'user-1',
    account: ACCOUNT,
    mandateId: '1',
    requestId: REQUEST,
    inputHash: 'a'.repeat(64),
    text: 'Pay 40 USDC to Design contractor',
    parsedRecipient: null,
    parsedAmount: null,
    state: 'queued',
    providerOperationId: null,
    txHash: null,
    rule: null,
    attemptedUnits: null,
    headroomUnits: null,
    errorCode: null,
    leaseOwner: 'worker-1',
    txNonce: null,
    signedRawTransaction: null,
    signingKeyArn: null,
    unsignedIntentHash: null,
    ...overrides,
  };
}

class FakeJournal implements WorkerJournal {
  current: JournalRequest | null;
  finishes: Array<Record<string, unknown>> = [];
  submissions = 0;
  prepared = 0;
  signed: Array<{ rawTransaction: string; txHash: string }> = [];
  broadcasts = 0;
  broadcastErrors: string[] = [];

  constructor(current: JournalRequest) {
    this.current = current;
  }

  async claimNext() {
    const claimed = this.current;
    this.current = null;
    return claimed;
  }

  async markSigning(_id: string, _worker: string, recipient: Address, amount: string) {
    if (this.current) {
      this.current.parsedRecipient = recipient;
      this.current.parsedAmount = amount;
    }
  }

  async recordSubmission() {
    this.submissions += 1;
  }

  async prepareSigning(input: {
    recipient: Address;
    amountUnits: string;
    unsignedIntentHash: string;
    readPendingNonce: () => Promise<number>;
  }) {
    this.prepared += 1;
    const nonce = await input.readPendingNonce();
    if (this.current) {
      this.current.state = 'signing_prepared';
      this.current.parsedRecipient = input.recipient;
      this.current.parsedAmount = input.amountUnits;
      this.current.txNonce = String(nonce);
      this.current.unsignedIntentHash = input.unsignedIntentHash;
    }
    return { nonce, reused: false };
  }

  async recordSigned(input: { rawTransaction: string; txHash: Hex32 }) {
    this.signed.push({ rawTransaction: input.rawTransaction, txHash: input.txHash });
  }

  async recordBroadcast() {
    this.broadcasts += 1;
  }

  async recordBroadcastError(_id: string, _worker: string, error: string) {
    this.broadcastErrors.push(error);
  }

  async finish(_id: string, _worker: string, result: Record<string, unknown>) {
    this.finishes.push(result);
  }
}

class FakeSigner implements ScopedAgentSigner {
  sendTransaction = vi.fn(async (_request: TransactionRequest) => ({
    txHash: TX,
    providerOperationId: 'operation-1',
  }));
  getSubmission = vi.fn(async () => ({ txHash: TX, providerOperationId: 'operation-1' }));
}

class ThrowingSigner extends FakeSigner {
  constructor(error: Error) {
    super();
    this.sendTransaction = vi.fn(async () => {
      throw error;
    });
  }
}

class FakeKmsSigner implements AgentSigner {
  readonly provider = 'aws_kms' as const;
  signTransaction = vi.fn(async (transaction: UnsignedEip1559Transaction) => ({
    rawTransaction: RAW,
    transactionHash: keccak256(RAW) as Hex32,
    from: AGENT,
    nonce: transaction.nonce,
  }));
  async getAddress(): Promise<Address> {
    return AGENT;
  }
}

const EXECUTED: StoredRequest = {
  agent: AGENT,
  recipient: RECIPIENT,
  attempted: 40_000_000n,
  headroom: 60_000_000n,
  spentAfter: 40_000_000n,
  outcome: 1,
  rule: 0,
  reason: 'Payment executed',
};

const ACTIVE_MANDATE: StoredMandate = {
  agent: AGENT,
  perPaymentCap: 100_000_000n,
  cumulativeCap: 100_000_000n,
  spent: 0n,
  expiresAt: 9_999_999_999n,
  revoked: false,
  exists: true,
};

class FakeChain implements PaymentChain {
  stored: StoredRequest = EXECUTED;
  mandate: StoredMandate = ACTIVE_MANDATE;
  activeMandateId = 1n;
  pending = 7;
  broadcast = vi.fn(
    async (_raw: Hex): Promise<{ txHash: Hex32; status: 'accepted' | 'already-known' }> => ({
      txHash: TX,
      status: 'accepted',
    }),
  );

  async waitForReceipt(): Promise<ConfirmedReceipt> {
    return {
      transactionHash: TX,
      blockNumber: 10n,
      blockHash: `0x${'cd'.repeat(32)}`,
      status: 'success',
      from: AGENT,
      to: ACCOUNT,
      logs: [],
    };
  }

  async getReceiptIfPresent() {
    return this.waitForReceipt();
  }

  async readRequest(): Promise<StoredRequest> {
    return this.stored;
  }

  async readActiveMandateId() {
    return this.activeMandateId;
  }

  async readMandate() {
    return this.mandate;
  }

  async nativeBalance() {
    return 10n ** 18n;
  }

  async pendingNonce() {
    return this.pending;
  }

  async latestNonce() {
    return this.pending;
  }

  async feeParameters() {
    return { maxFeePerGas: 5_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n };
  }

  async estimatePayGas() {
    return 120_000n;
  }

  async broadcastRawTransaction(raw: Hex) {
    return this.broadcast(raw);
  }
}

const KMS_CONFIG: KmsExecutionConfig = {
  keyArn: 'arn:aws:kms:ap-northeast-1:111122223333:key/demo',
  maxGas: 400_000n,
  maxFeePerGas: 20_000_000_000n,
  maxPriorityFeePerGas: 3_000_000_000n,
  gasMargin: 1.25,
  gasLowWatermark: 200_000_000_000_000n,
};

function privyContext(signer: FakeSigner, chain: PaymentChain = new FakeChain()): WorkerContext {
  const verified: VerifiedAgentContext = {
    userSubject: 'user-1',
    chainId: ARC_TESTNET_CHAIN_ID,
    account: ACCOUNT,
    agentAddress: AGENT,
    agentWalletId: 'wallet-1',
  };
  return {
    mode: 'privy',
    context: verified,
    recipients: [{ label: 'Design contractor', address: RECIPIENT }],
    signer,
    chain,
  };
}

function kmsContext(signer: AgentSigner, chain: PaymentChain = new FakeChain()): WorkerContext {
  const verified: VerifiedAgentContext = {
    userSubject: 'user-1',
    chainId: ARC_TESTNET_CHAIN_ID,
    account: ACCOUNT,
    agentAddress: AGENT,
    agentWalletId: 'aws_kms',
  };
  return {
    mode: 'aws_kms',
    context: verified,
    recipients: [{ label: 'Design contractor', address: RECIPIENT }],
    signer,
    chain,
    kms: KMS_CONFIG,
  };
}

describe('payment worker recovery (privy)', () => {
  it('processes one queued instruction through a confirmed result', async () => {
    const journal = new FakeJournal(job());
    const signer = new FakeSigner();
    const worker = new PaymentWorker('worker-1', journal, {
      resolve: async () => privyContext(signer),
    });
    await expect(worker.tick()).resolves.toBe(true);
    expect(signer.sendTransaction).toHaveBeenCalledOnce();
    expect(journal.submissions).toBe(1);
    expect(journal.finishes.at(-1)).toMatchObject({ state: 'executed', headroomUnits: '60000000' });
  });

  it('reconciles a provider operation without signing again', async () => {
    const journal = new FakeJournal(
      job({
        state: 'submitted',
        providerOperationId: 'operation-1',
        parsedRecipient: RECIPIENT,
        parsedAmount: '40000000',
      }),
    );
    const signer = new FakeSigner();
    const worker = new PaymentWorker('worker-1', journal, {
      resolve: async () => privyContext(signer),
    });
    await worker.tick();
    expect(signer.getSubmission).toHaveBeenCalledWith('operation-1');
    expect(signer.sendTransaction).not.toHaveBeenCalled();
    expect(journal.finishes.at(-1)).toMatchObject({ state: 'executed' });
  });

  it('replays a lost signing response with the same idempotency key', async () => {
    const signer = new FakeSigner();
    const first = new FakeJournal(job());
    await new PaymentWorker('worker-1', first, {
      resolve: async () => privyContext(signer),
    }).tick();
    const original = signer.sendTransaction.mock.calls[0]![0];

    const recovered = new FakeJournal(
      job({ state: 'signing', parsedRecipient: RECIPIENT, parsedAmount: '40000000' }),
    );
    await new PaymentWorker('worker-1', recovered, {
      resolve: async () => privyContext(signer),
    }).tick();

    expect(signer.sendTransaction).toHaveBeenCalledTimes(2);
    expect(signer.sendTransaction.mock.calls[1]![0]).toEqual(original);
    expect(recovered.finishes.at(-1)).toMatchObject({ state: 'executed' });
  });

  it('reports an unauthorized Privy chain as a signer configuration block', async () => {
    const journal = new FakeJournal(job());
    const signer = new ThrowingSigner(
      new SignerConfigurationError(
        'SIGNER_CHAIN_UNAUTHORIZED',
        'Privy app is not authorized for the configured chain',
      ),
    );
    await new PaymentWorker('worker-1', journal, {
      resolve: async () => privyContext(signer),
    }).tick();
    expect(journal.finishes.at(-1)).toMatchObject({
      state: 'signer_blocked',
      errorCode: 'SIGNER_CHAIN_UNAUTHORIZED',
    });
  });
});

describe('payment worker (aws_kms) persist-before-broadcast', () => {
  it('parses, reserves a nonce, signs once, persists bytes, broadcasts, and reconciles', async () => {
    const journal = new FakeJournal(job());
    const signer = new FakeKmsSigner();
    const chain = new FakeChain();
    const worker = new PaymentWorker('worker-1', journal, {
      resolve: async () => kmsContext(signer, chain),
    });

    await expect(worker.tick()).resolves.toBe(true);

    expect(journal.prepared).toBe(1);
    expect(signer.signTransaction).toHaveBeenCalledOnce();
    // The reserved nonce is the pending chain nonce read inside the lock.
    expect(signer.signTransaction.mock.calls[0]![0].nonce).toBe(7);
    // The exact bytes are persisted before the broadcast is attempted.
    expect(journal.signed).toEqual([{ rawTransaction: RAW, txHash: keccak256(RAW) }]);
    expect(chain.broadcast).toHaveBeenCalledWith(RAW);
    expect(journal.broadcasts).toBe(1);
    expect(journal.finishes.at(-1)).toMatchObject({ state: 'executed', headroomUnits: '60000000' });
  });

  it('rebroadcasts the exact stored bytes after a crash without signing again', async () => {
    const journal = new FakeJournal(
      job({
        state: 'signed',
        signedRawTransaction: RAW,
        txHash: keccak256(RAW) as Hex32,
        txNonce: '7',
        parsedRecipient: RECIPIENT,
        parsedAmount: '40000000',
      }),
    );
    const signer = new FakeKmsSigner();
    const chain = new FakeChain();
    await new PaymentWorker('worker-1', journal, {
      resolve: async () => kmsContext(signer, chain),
    }).tick();

    expect(signer.signTransaction).not.toHaveBeenCalled();
    expect(chain.broadcast).toHaveBeenCalledWith(RAW);
    expect(journal.finishes.at(-1)).toMatchObject({ state: 'executed' });
  });

  it('re-signs a prepared row under the same reserved nonce when no bytes were stored', async () => {
    const journal = new FakeJournal(
      job({
        state: 'signing_prepared',
        txNonce: '7',
        parsedRecipient: RECIPIENT,
        parsedAmount: '40000000',
        unsignedIntentHash: `0x${'11'.repeat(32)}`,
      }),
    );
    const signer = new FakeKmsSigner();
    await new PaymentWorker('worker-1', journal, {
      resolve: async () => kmsContext(signer, new FakeChain()),
    }).tick();

    expect(journal.prepared).toBe(0);
    expect(signer.signTransaction).toHaveBeenCalledOnce();
    expect(signer.signTransaction.mock.calls[0]![0].nonce).toBe(7);
    expect(journal.finishes.at(-1)).toMatchObject({ state: 'executed' });
  });

  it('blocks before signing when the on-chain mandate is not the stored mandate', async () => {
    const journal = new FakeJournal(job());
    const signer = new FakeKmsSigner();
    const chain = new FakeChain();
    chain.activeMandateId = 2n;
    await new PaymentWorker('worker-1', journal, {
      resolve: async () => kmsContext(signer, chain),
    }).tick();

    expect(signer.signTransaction).not.toHaveBeenCalled();
    expect(journal.finishes.at(-1)).toMatchObject({
      state: 'signer_blocked',
      errorCode: 'MANDATE_NOT_ACTIVE',
    });
  });

  it('refuses before signing when the agent gas reserve is below the low watermark', async () => {
    const journal = new FakeJournal(job());
    const signer = new FakeKmsSigner();
    const chain = new FakeChain();
    chain.nativeBalance = async () => 1_000n; // far below gasLowWatermark
    await new PaymentWorker('worker-1', journal, {
      resolve: async () => kmsContext(signer, chain),
    }).tick();
    expect(signer.signTransaction).not.toHaveBeenCalled();
    expect(journal.finishes.at(-1)).toMatchObject({
      state: 'signer_blocked',
      errorCode: 'AGENT_GAS_INSUFFICIENT',
    });
  });

  it('does not fabricate a new transaction on nonce too low; it reconciles the local hash', async () => {
    const journal = new FakeJournal(
      job({
        state: 'signed',
        signedRawTransaction: RAW,
        txHash: keccak256(RAW) as Hex32,
        txNonce: '7',
        parsedRecipient: RECIPIENT,
        parsedAmount: '40000000',
      }),
    );
    const signer = new FakeKmsSigner();
    const chain = new FakeChain();
    chain.broadcast = vi.fn(async () => {
      throw new NonceTooLowError('nonce too low');
    });
    await new PaymentWorker('worker-1', journal, {
      resolve: async () => kmsContext(signer, chain),
    }).tick();

    expect(signer.signTransaction).not.toHaveBeenCalled();
    // The already-mined transaction reconciled to its stored outcome.
    expect(journal.finishes.at(-1)).toMatchObject({ state: 'executed' });
  });

  it('holds an ambiguous broadcast as unknown and keeps the stored bytes', async () => {
    const journal = new FakeJournal(
      job({
        state: 'signed',
        signedRawTransaction: RAW,
        txHash: keccak256(RAW) as Hex32,
        txNonce: '7',
        parsedRecipient: RECIPIENT,
        parsedAmount: '40000000',
      }),
    );
    const signer = new FakeKmsSigner();
    const chain = new FakeChain();
    chain.broadcast = vi.fn(async () => {
      throw new BroadcastAmbiguousError('reset');
    });
    await new PaymentWorker('worker-1', journal, {
      resolve: async () => kmsContext(signer, chain),
    }).tick();

    expect(journal.broadcastErrors).toEqual(['BROADCAST_AMBIGUOUS']);
    expect(journal.finishes.at(-1)).toMatchObject({
      state: 'unknown',
      errorCode: 'BROADCAST_AMBIGUOUS',
    });
  });
});
