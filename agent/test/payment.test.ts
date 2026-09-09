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
import { AuthenticationError } from '@privy-io/node';
import { parseInstruction } from '../src/payment/parse-instruction.js';
import { submitPayment } from '../src/payment/submit-payment.js';
import {
  PaymentIntegrityError,
  SignerConfigurationError,
  SignerPolicyError,
  type ConfirmedReceipt,
  type PaymentChain,
  type ScopedAgentSigner,
  type StoredRequest,
  type TransactionRequest,
} from '../src/payment/types.js';
import { classifyPrivySignerError } from '../src/privy/signer.js';
import {
  agentPolicyDisclosure,
  buildAgentSignerPolicy,
  evaluateAgentPolicy,
  PRIVY_POLICY_NAME_MAX_LENGTH,
} from '../src/privy/policy.js';

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

  async getReceiptIfPresent() {
    return this.receipt;
  }

  async readRequest() {
    return this.stored;
  }

  async readActiveMandateId() {
    return 1n;
  }

  async readMandate() {
    return {
      agent: AGENT,
      perPaymentCap: 100_000_000n,
      cumulativeCap: 100_000_000n,
      spent: 0n,
      expiresAt: 9_999_999_999n,
      revoked: false,
      exists: true,
    };
  }

  async nativeBalance() {
    return 10n ** 18n;
  }

  async pendingNonce() {
    return 0;
  }

  async latestNonce() {
    return 0;
  }

  async feeParameters() {
    return { maxFeePerGas: 2_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n };
  }

  async estimatePayGas() {
    return 120_000n;
  }

  async broadcastRawTransaction() {
    return { txHash: TX, status: 'accepted' as const };
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

  it.each(['Send 0.1 USDC to Design contractor', 'transfer 0.1 usdc to Design contractor'])(
    'accepts "%s" as the same payment verb',
    async (instruction) => {
      await expect(parseInstruction(instruction, recipients)).resolves.toEqual({
        kind: 'payment',
        intent: { recipient: RECIPIENT, amountUsdc: '0.1' },
      });
    },
  );

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

describe('canonical restricted signer policy', () => {
  const policy = buildAgentSignerPolicy(ACCOUNT);
  const allowed = {
    method: 'eth_sendTransaction',
    chainId: ARC_TESTNET_CHAIN_ID,
    to: ACCOUNT,
    value: 0n,
  };

  it('permits exactly one envelope', () => {
    expect(evaluateAgentPolicy(policy, allowed)).toBe('ALLOW');
    expect(evaluateAgentPolicy(policy, { ...allowed, chainId: ARC_TESTNET_CAIP2 })).toBe('ALLOW');
  });

  it.each([
    ['wrong chain', { ...allowed, chainId: 1 }],
    ['wrong destination', { ...allowed, to: RECIPIENT }],
    ['missing destination', { ...allowed, to: null }],
    ['non-zero native value', { ...allowed, value: 1n }],
    ['another method', { ...allowed, method: 'personal_sign' }],
    ['typed data signing', { ...allowed, method: 'eth_signTypedData_v4' }],
  ])('denies %s by default', (_name, envelope) => {
    expect(evaluateAgentPolicy(policy, envelope)).toBe('DENY');
  });

  it('submits the same rules it displays and never claims calldata restriction', () => {
    const disclosure = agentPolicyDisclosure(ACCOUNT);
    expect(disclosure.policyName).toBe(policy.name);
    expect(disclosure.destination).toBe(ACCOUNT);
    expect(disclosure.calldataRestricted).toBe(false);
    expect(policy.name.toLowerCase()).not.toContain('pay only');
    expect(policy.rules[0]!.conditions.map((condition) => condition.field)).toEqual([
      'chain_id',
      'to',
      'value',
    ]);
  });

  it('keeps policy and rule names within Privy API limits', () => {
    expect(policy.name.length).toBeLessThan(PRIVY_POLICY_NAME_MAX_LENGTH);
    expect(policy.rules).not.toHaveLength(0);
    for (const rule of policy.rules) {
      expect(rule.name.length).toBeLessThan(PRIVY_POLICY_NAME_MAX_LENGTH);
    }
  });
});

describe('Privy signer errors', () => {
  it('classifies an app chain authorization failure without exposing provider text', () => {
    const error = new AuthenticationError(
      401,
      { error: 'App is not authorized to transact on chain eip155:5042002' },
      'App is not authorized to transact on chain eip155:5042002',
      new Headers(),
    );
    expect(classifyPrivySignerError(error)).toMatchObject<SignerConfigurationError>({
      name: 'SignerConfigurationError',
      code: 'SIGNER_CHAIN_UNAUTHORIZED',
      message: 'Privy app is not authorized for the configured chain',
    });
  });
});
