import { golAccountAbi, type Address, type Hex, type Hex32 } from '@gol/protocol';
import { encodeFunctionData } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  PAY_SELECTOR,
  validateSignerEnvelope,
  type EnvelopeExpectation,
} from '../src/signers/envelope.js';
import {
  SignerEnvelopeRejectedError,
  type UnsignedEip1559Transaction,
} from '../src/signers/types.js';

const ACCOUNT = '0x00000000000000000000000000000000000acc17' as Address;
const SIGNER = '0x00000000000000000000000000000000000a6e17' as Address;
const RECIPIENT = '0x000000000000000000000000000000000000beef' as Address;
const REQUEST = `0x${'01'.repeat(32)}` as Hex32;
const AMOUNT = 40_000_000n;
const MANDATE = 1n;

function payData(
  overrides: {
    mandateId?: bigint;
    requestId?: Hex32;
    recipient?: Address;
    amount?: bigint;
  } = {},
): Hex {
  return encodeFunctionData({
    abi: golAccountAbi,
    functionName: 'pay',
    args: [
      overrides.mandateId ?? MANDATE,
      overrides.requestId ?? REQUEST,
      overrides.recipient ?? RECIPIENT,
      overrides.amount ?? AMOUNT,
    ],
  });
}

function tx(overrides: Partial<UnsignedEip1559Transaction> = {}): UnsignedEip1559Transaction {
  return {
    type: 'eip1559',
    chainId: 5042002,
    nonce: 4,
    to: ACCOUNT,
    value: 0n,
    data: payData(),
    gas: 150_000n,
    maxFeePerGas: 3_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    accessList: [],
    ...overrides,
  };
}

function expectation(overrides: Partial<EnvelopeExpectation> = {}): EnvelopeExpectation {
  return {
    chainId: 5042002,
    configuredSender: SIGNER,
    signerAddress: SIGNER,
    account: ACCOUNT,
    mandateId: MANDATE,
    onChainMandateId: MANDATE,
    requestId: REQUEST,
    recipient: RECIPIENT,
    amount: AMOUNT,
    maxGas: 400_000n,
    maxFeePerGasCeiling: 20_000_000_000n,
    maxPriorityFeePerGasCeiling: 3_000_000_000n,
    ...overrides,
  };
}

describe('mandatory signer envelope validator', () => {
  it('accepts a fully consistent GolAccount.pay transaction', () => {
    expect(() => validateSignerEnvelope(tx(), expectation())).not.toThrow();
  });

  it('exposes the canonical pay selector', () => {
    expect(tx().data.slice(0, 10)).toBe(PAY_SELECTOR);
  });

  const cases: Array<[string, () => void, string]> = [
    [
      'wrong chain id',
      () => validateSignerEnvelope(tx({ chainId: 1 as never }), expectation()),
      'chainId',
    ],
    [
      'signer differs from configured sender',
      () => validateSignerEnvelope(tx(), expectation({ signerAddress: RECIPIENT })),
      'sender',
    ],
    [
      'destination is not the linked account',
      () => validateSignerEnvelope(tx({ to: RECIPIENT }), expectation()),
      'destination',
    ],
    [
      'non-zero native value',
      () => validateSignerEnvelope(tx({ value: 1n as never }), expectation()),
      'value',
    ],
    [
      'calldata is not pay',
      () =>
        validateSignerEnvelope(
          tx({
            data: encodeFunctionData({ abi: golAccountAbi, functionName: 'remaining', args: [1n] }),
          }),
          expectation(),
        ),
      'selector',
    ],
    [
      'stored mandate differs from on-chain mandate',
      () => validateSignerEnvelope(tx(), expectation({ onChainMandateId: 2n })),
      'mandateId',
    ],
    [
      'calldata mandate id mismatch',
      () => validateSignerEnvelope(tx({ data: payData({ mandateId: 2n }) }), expectation()),
      'mandateId',
    ],
    [
      'calldata request id mismatch',
      () =>
        validateSignerEnvelope(
          tx({ data: payData({ requestId: `0x${'02'.repeat(32)}` }) }),
          expectation(),
        ),
      'requestId',
    ],
    [
      'calldata recipient mismatch',
      () =>
        validateSignerEnvelope(
          tx({ data: payData({ recipient: '0x000000000000000000000000000000000000c0de' }) }),
          expectation(),
        ),
      'recipient',
    ],
    [
      'calldata amount mismatch',
      () => validateSignerEnvelope(tx({ data: payData({ amount: 41_000_000n }) }), expectation()),
      'amount',
    ],
    [
      'gas over the ceiling',
      () => validateSignerEnvelope(tx({ gas: 500_000n }), expectation()),
      'gas',
    ],
    ['zero gas', () => validateSignerEnvelope(tx({ gas: 0n }), expectation()), 'gas'],
    [
      'fee over the ceiling',
      () => validateSignerEnvelope(tx({ maxFeePerGas: 999_000_000_000n }), expectation()),
      'fees',
    ],
    [
      'priority fee above max fee',
      () => validateSignerEnvelope(tx({ maxPriorityFeePerGas: 9_000_000_000n }), expectation()),
      'fees',
    ],
    ['negative nonce', () => validateSignerEnvelope(tx({ nonce: -1 }), expectation()), 'nonce'],
    [
      'non-empty access list',
      () => validateSignerEnvelope(tx({ accessList: [{}] as never }), expectation()),
      'accessList',
    ],
  ];

  it.each(cases)('rejects %s before signing', (_name, run, field) => {
    try {
      run();
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(SignerEnvelopeRejectedError);
      expect((error as SignerEnvelopeRejectedError).code).toBe('SIGNER_ENVELOPE_REJECTED');
      expect((error as SignerEnvelopeRejectedError).field).toBe(field);
    }
  });
});
