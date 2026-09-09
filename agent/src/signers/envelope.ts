import { golAccountAbi, type Address, type Hex32 } from '@gol/protocol';
import { decodeFunctionData, toFunctionSelector } from 'viem';
import { SignerEnvelopeRejectedError, type UnsignedEip1559Transaction } from './types.js';

/** Canonical selector for `GolAccount.pay`. Computed once from the signature, never hand-written. */
export const PAY_SELECTOR = toFunctionSelector('pay(uint256,bytes32,address,uint256)');

/**
 * Every value the mandatory envelope validator checks. All of it comes from trusted configuration
 * and immutable journal state; none of it comes from HTTP, a model, or an editable database field.
 */
export interface EnvelopeExpectation {
  chainId: 5042002;
  /** Derived configured KMS address. */
  configuredSender: Address;
  /** The signer instance about to be used, proven to derive {@link configuredSender}. */
  signerAddress: Address;
  /** The authenticated user's linked `GolAccount`. */
  account: Address;
  /** Stored request mandate ID. */
  mandateId: bigint;
  /** Current on-chain active mandate ID, read immediately before signing. */
  onChainMandateId: bigint;
  /** Stored immutable journal request ID. */
  requestId: Hex32;
  /** Stored parsed recipient, already verified against the server address book. */
  recipient: Address;
  /** Stored exact amount in six-decimal units. */
  amount: bigint;
  /** Hard transaction gas ceiling. */
  maxGas: bigint;
  /** Configured `maxFeePerGas` ceiling. */
  maxFeePerGasCeiling: bigint;
  /** Configured `maxPriorityFeePerGas` ceiling. */
  maxPriorityFeePerGasCeiling: bigint;
}

/**
 * Validates the constructed unsigned transaction immediately before `kms:Sign`. Any mismatch throws
 * {@link SignerEnvelopeRejectedError} with a stable `SIGNER_ENVELOPE_REJECTED` code and produces no
 * Arc policy-refusal record, because nothing is submitted.
 */
export function validateSignerEnvelope(
  transaction: UnsignedEip1559Transaction,
  expected: EnvelopeExpectation,
): void {
  const reject = (field: string, message: string): never => {
    throw new SignerEnvelopeRejectedError(field, message);
  };

  if (transaction.type !== 'eip1559') reject('type', 'Transaction is not EIP-1559 type 2');
  if (transaction.chainId !== 5042002 || expected.chainId !== 5042002) {
    reject('chainId', 'Chain ID is not 5042002');
  }
  if (expected.signerAddress.toLowerCase() !== expected.configuredSender.toLowerCase()) {
    reject('sender', 'Signer address does not match the configured KMS address');
  }
  if (transaction.to.toLowerCase() !== expected.account.toLowerCase()) {
    reject('destination', 'Destination is not the linked GolAccount');
  }
  if (transaction.value !== 0n) reject('value', 'Native value is not zero');

  if (typeof transaction.data !== 'string' || !transaction.data.startsWith('0x')) {
    reject('data', 'Calldata is not a hex string');
  }
  if (transaction.data.slice(0, 10).toLowerCase() !== PAY_SELECTOR.toLowerCase()) {
    reject('selector', 'Calldata selector is not GolAccount.pay');
  }

  let decoded;
  try {
    decoded = decodeFunctionData({ abi: golAccountAbi, data: transaction.data });
  } catch {
    return void reject('data', 'Calldata does not decode against the GolAccount ABI');
  }
  if (decoded.functionName !== 'pay') reject('selector', 'Decoded function is not pay');
  const [mandateArg, requestArg, recipientArg, amountArg] = decoded.args as [
    bigint,
    Hex32,
    Address,
    bigint,
  ];

  if (expected.mandateId !== expected.onChainMandateId) {
    reject('mandateId', 'Stored mandate ID does not match the current on-chain mandate');
  }
  if (mandateArg !== expected.mandateId) reject('mandateId', 'Calldata mandate ID mismatch');
  if (requestArg.toLowerCase() !== expected.requestId.toLowerCase()) {
    reject('requestId', 'Calldata request ID mismatch');
  }
  if (recipientArg.toLowerCase() !== expected.recipient.toLowerCase()) {
    reject('recipient', 'Calldata recipient mismatch');
  }
  if (amountArg !== expected.amount) reject('amount', 'Calldata amount mismatch');

  if (transaction.gas <= 0n || transaction.gas > expected.maxGas) {
    reject('gas', 'Gas is outside the permitted range');
  }
  if (transaction.maxFeePerGas <= 0n || transaction.maxFeePerGas > expected.maxFeePerGasCeiling) {
    reject('fees', 'maxFeePerGas is outside the permitted range');
  }
  if (
    transaction.maxPriorityFeePerGas < 0n ||
    transaction.maxPriorityFeePerGas > transaction.maxFeePerGas ||
    transaction.maxPriorityFeePerGas > expected.maxPriorityFeePerGasCeiling
  ) {
    reject('fees', 'maxPriorityFeePerGas is outside the permitted range');
  }
  if (!Number.isInteger(transaction.nonce) || transaction.nonce < 0) {
    reject('nonce', 'Nonce is not a reserved non-negative integer');
  }
  if (transaction.accessList.length !== 0) {
    reject('accessList', 'Access list is not empty');
  }
}
