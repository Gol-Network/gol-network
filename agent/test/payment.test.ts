import {
  ARC_TESTNET_CAIP2,
  ARC_TESTNET_CHAIN_ID,
  golAccountAbi,
  parseUsdc,
  type Address,
  type Hex32,
  type RecipientLabel,
  type VerifiedAgentContext,
} from '@gol/protocol';
import { decodeFunctionData } from 'viem';
import { describe, expect, it } from 'vitest';
import { parseInstruction } from '../src/payment/parse-instruction.js';
import { submitPayment } from '../src/payment/submit-payment.js';
import {
  PaymentIntegrityError,
  SignerPolicyError,
  type ConfirmedReceipt,
  type PaymentChain,
  type ScopedAgentSigner,
  type StoredRequest,
  type TransactionRequest,
} from '../src/payment/types.js';
import { assertPolicyTransaction, buildAgentSignerPolicy } from '../src/privy/policy.js';

const ACCOUNT = '0x0000000000000000000000000000000000Acc017' as Address;
const AGENT = '0x00000000000000000000000000000000000A6E17' as Address;
const RECIPIENT = '0x000000000000000000000000000000000000bEEF' as Address;
const TX = `0x${'ab'.repeat(32)}` as Hex32;
const REQUEST = `0x${'01'.repeat(32)}` as Hex32;

const context: VerifiedAgentContext = {
  userSubject: 'user-1',
  chainId: ARC_TESTNET_CHAIN_ID,
  account: ACCOUNT,
  agentAddress: AGENT,
  agentWalletId: 'wallet-1',
};

const recipients: RecipientLabel[] = [{ label: 'Design contractor', address: RECIPIENT }];

class FakeSigner implements ScopedAgentSigner {
  requests: TransactionRequest[] = [];
  blocked = false;

  async sendTransaction(request: TransactionRequest) {
    this.requests.push(request);
    if (this.blocked) throw new SignerPolicyError('denied');
    return { txHash: TX, providerOperationId: 'operation-1' };
  }

  async getSubmission() {
    return { txHash: TX, providerOperationId: 'operation-1' };
  }
}

class FakeChain implements PaymentChain {
  stored: StoredRequest = {
    agent: AGENT,
    recipient: RECIPIENT,
    attempted: 40_000_000n,
    headroom: 60_000_000n,
    spentAfter: 40_000_000n,
    outcome: 1,
    rule: 0,
    reason: 'Payment executed',
  };

  receipt: ConfirmedReceipt = {
    transactionHash: TX,
    blockNumber: 100n,
    blockHash: `0x${'cd'.repeat(32)}` as Hex32,
    status: 'success',
    from: AGENT,
    to: ACCOUNT,
    logs: [],
  };

  async waitForReceipt() {
    return this.receipt;
  }

  async readRequest() {
    return this.stored;
  }
}

describe('payment parser', () => {
  it('parses one exact approved payment without a model', async () => {
    await expect(parseInstruction('Pay 40 USDC to Design contractor', recipients)).resolves.toEqual(
      {
        kind: 'payment',
        intent: { recipient: RECIPIENT, amountUsdc: '40' },
      },
    );
  });

  it.each([
    'Pay 0 USDC to Design contractor',
    'Pay 1e6 USDC to Design contractor',
    'Pay 40 USDC to Unknown contractor',
    'Send half the budget',
  ])('does not invent a payment for %s', async (instruction) => {
    expect((await parseInstruction(instruction, recipients)).kind).toBe('clarification');
  });
});

describe('payment submission', () => {
  it('encodes only pay and confirms stored execution', async () => {
    const signer = new FakeSigner();
    const payment = await submitPayment(
      context,
      REQUEST,
      '1',
      { recipient: RECIPIENT, amountUsdc: '40' },
      signer,
      new FakeChain(),
    );
    expect(payment).toMatchObject({ state: 'executed', headroomUnits: '60000000' });
    expect(signer.requests).toHaveLength(1);
    expect(signer.requests[0]).toMatchObject({
      chainId: ARC_TESTNET_CHAIN_ID,
      to: ACCOUNT,
      value: 0n,
    });
    expect(decodeFunctionData({ abi: golAccountAbi, data: signer.requests[0]!.data })).toEqual({
      functionName: 'pay',
      args: [1n, REQUEST, RECIPIENT, parseUsdc('40')],
    });
  });

  it('submits an expected policy refusal and reports its stored rule', async () => {
    const signer = new FakeSigner();
    const chain = new FakeChain();
    chain.stored = {
      ...chain.stored,
      attempted: 70_000_000n,
      outcome: 2,
      rule: 5,
      reason: 'Cumulative cap exceeded',
    };
    const payment = await submitPayment(
      context,
      REQUEST,
      '1',
      { recipient: RECIPIENT, amountUsdc: '70' },
      signer,
      chain,
    );
    expect(payment).toMatchObject({
      state: 'refused',
      rule: 'CUMULATIVE_CAP',
      headroomUnits: '60000000',
    });
    expect(signer.requests).toHaveLength(1);
  });

  it('separates signer denial from an on-chain refusal', async () => {
    const signer = new FakeSigner();
    signer.blocked = true;
    const payment = await submitPayment(
      context,
      REQUEST,
      '1',
      { recipient: RECIPIENT, amountUsdc: '40' },
      signer,
      new FakeChain(),
    );
    expect(payment).toMatchObject({ state: 'signer_blocked', txHash: null, rule: null });
  });

  it('fails closed when the receipt sender differs', async () => {
    const chain = new FakeChain();
    chain.receipt = { ...chain.receipt, from: RECIPIENT };
    await expect(
      submitPayment(
        context,
        REQUEST,
        '1',
        { recipient: RECIPIENT, amountUsdc: '40' },
        new FakeSigner(),
        chain,
      ),
    ).rejects.toBeInstanceOf(PaymentIntegrityError);
  });
});

describe('restricted signer policy', () => {
  it('allows only zero-value calls to the configured account and chain', () => {
    const policy = buildAgentSignerPolicy(ACCOUNT);
    expect(() =>
      assertPolicyTransaction(policy, { chainId: ARC_TESTNET_CAIP2, to: ACCOUNT, value: 0n }),
    ).not.toThrow();
    expect(() =>
      assertPolicyTransaction(policy, { chainId: ARC_TESTNET_CAIP2, to: RECIPIENT, value: 0n }),
    ).toThrow('SIGNER_POLICY_DENIED');
    expect(() =>
      assertPolicyTransaction(policy, { chainId: ARC_TESTNET_CAIP2, to: ACCOUNT, value: 1n }),
    ).toThrow('SIGNER_POLICY_DENIED');
  });
});
