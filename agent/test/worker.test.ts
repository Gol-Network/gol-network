import {
  ARC_TESTNET_CHAIN_ID,
  type Address,
  type Hex32,
  type VerifiedAgentContext,
} from '@gol/protocol';
import { describe, expect, it, vi } from 'vitest';
import type { JournalRequest } from '../src/db/journal.js';
import type {
  ConfirmedReceipt,
  PaymentChain,
  ScopedAgentSigner,
  StoredRequest,
  TransactionRequest,
} from '../src/payment/types.js';
import { SignerConfigurationError } from '../src/payment/types.js';
import { PaymentWorker, type WorkerContext, type WorkerJournal } from '../src/payment/worker.js';

const ACCOUNT = '0x0000000000000000000000000000000000acc017' as Address;
const AGENT = '0x00000000000000000000000000000000000a6e17' as Address;
const RECIPIENT = '0x000000000000000000000000000000000000beef' as Address;
const REQUEST = `0x${'01'.repeat(32)}` as Hex32;
const TX = `0x${'ab'.repeat(32)}` as Hex32;

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
    ...overrides,
  };
}

class FakeJournal implements WorkerJournal {
  current: JournalRequest | null;
  finishes: Array<Record<string, unknown>> = [];
  submissions = 0;

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
    this.submissions++;
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

class FakeChain implements PaymentChain {
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

  async readRequest(): Promise<StoredRequest> {
    return {
      agent: AGENT,
      recipient: RECIPIENT,
      attempted: 40_000_000n,
      headroom: 60_000_000n,
      spentAfter: 40_000_000n,
      outcome: 1,
      rule: 0,
      reason: 'Payment executed',
    };
  }
}

function context(signer: FakeSigner): WorkerContext {
  const verified: VerifiedAgentContext = {
    userSubject: 'user-1',
    chainId: ARC_TESTNET_CHAIN_ID,
    account: ACCOUNT,
    agentAddress: AGENT,
    agentWalletId: 'wallet-1',
  };
  return {
    context: verified,
    recipients: [{ label: 'Design contractor', address: RECIPIENT }],
    signer,
    chain: new FakeChain(),
  };
}

describe('payment worker recovery', () => {
  it('processes one queued instruction through a confirmed result', async () => {
    const journal = new FakeJournal(job());
    const signer = new FakeSigner();
    const worker = new PaymentWorker('worker-1', journal, { resolve: async () => context(signer) });
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
    const worker = new PaymentWorker('worker-1', journal, { resolve: async () => context(signer) });
    await worker.tick();
    expect(signer.getSubmission).toHaveBeenCalledWith('operation-1');
    expect(signer.sendTransaction).not.toHaveBeenCalled();
    expect(journal.finishes.at(-1)).toMatchObject({ state: 'executed' });
  });

  it('replays a lost signing response with the same Privy idempotency key', async () => {
    const signer = new FakeSigner();
    const first = new FakeJournal(job());
    await new PaymentWorker('worker-1', first, { resolve: async () => context(signer) }).tick();
    const original = signer.sendTransaction.mock.calls[0]![0];

    // The worker stopped after marking the request as signing but before Privy's response landed.
    const recovered = new FakeJournal(
      job({ state: 'signing', parsedRecipient: RECIPIENT, parsedAmount: '40000000' }),
    );
    await new PaymentWorker('worker-1', recovered, { resolve: async () => context(signer) }).tick();

    expect(signer.sendTransaction).toHaveBeenCalledTimes(2);
    const replayed = signer.sendTransaction.mock.calls[1]![0];
    expect(replayed.referenceId).toBe(REQUEST.slice(2));
    expect(replayed).toEqual(original);
    expect(recovered.finishes.at(-1)).toMatchObject({ state: 'executed' });
  });

  it('reports an unresolved signing state without a stored intent as unknown', async () => {
    const journal = new FakeJournal(job({ state: 'signing' }));
    const signer = new FakeSigner();
    const worker = new PaymentWorker('worker-1', journal, { resolve: async () => context(signer) });
    await worker.tick();
    expect(signer.sendTransaction).not.toHaveBeenCalled();
    expect(journal.finishes.at(-1)).toMatchObject({
      state: 'unknown',
      errorCode: 'AMBIGUOUS_SIGNING_STATE',
    });
  });

  it('reports an unauthorized Privy chain as a signer configuration block', async () => {
    const journal = new FakeJournal(job());
    const signer = new ThrowingSigner(
      new SignerConfigurationError(
        'SIGNER_CHAIN_UNAUTHORIZED',
        'Privy app is not authorized for the configured chain',
      ),
    );
    await new PaymentWorker('worker-1', journal, { resolve: async () => context(signer) }).tick();
    expect(journal.finishes.at(-1)).toMatchObject({
      state: 'signer_blocked',
      errorCode: 'SIGNER_CHAIN_UNAUTHORIZED',
    });
  });

  it('does not hide a post-submission journal failure as an ambiguous provider response', async () => {
    const journal = new FakeJournal(job());
    journal.recordSubmission = vi.fn(async () => {
      throw new Error('LEASE_LOST');
    });
    const signer = new FakeSigner();
    const worker = new PaymentWorker('worker-1', journal, { resolve: async () => context(signer) });
    await expect(worker.tick()).rejects.toThrow('LEASE_LOST');
    expect(journal.finishes).toHaveLength(0);
  });
});
