import {
  golAccountAbi,
  parseUsdc,
  type Hex32,
  type PaymentIntent,
  type PaymentResult,
  type VerifiedAgentContext,
} from '@gol/protocol';
import { decodeEventLog } from 'viem';
import { createPaymentTransaction } from './submit-transaction.js';
import {
  PaymentIntegrityError,
  SignerPolicyError,
  type ConfirmedReceipt,
  type PaymentChain,
  type ScopedAgentSigner,
} from './types.js';

const RULES = [
  'NONE',
  'MANDATE_REVOKED',
  'MANDATE_EXPIRED',
  'RECIPIENT_NOT_ALLOWED',
  'PER_PAYMENT_CAP',
  'CUMULATIVE_CAP',
] as const;

export async function submitPayment(
  context: VerifiedAgentContext,
  requestId: Hex32,
  mandateId: string,
  intent: PaymentIntent,
  signer: ScopedAgentSigner,
  chain: PaymentChain,
): Promise<PaymentResult> {
  const amount = parseUsdc(intent.amountUsdc);

  let txHash: Hex32;
  try {
    ({ txHash } = await signer.sendTransaction(
      createPaymentTransaction(context, requestId, mandateId, intent),
    ));
  } catch (error) {
    if (error instanceof SignerPolicyError) {
      return result(requestId, 'signer_blocked', null, null, amount, null);
    }
    throw error;
  }

  return reconcilePayment(context, requestId, mandateId, intent, txHash, chain);
}

export async function reconcilePayment(
  context: VerifiedAgentContext,
  requestId: Hex32,
  mandateId: string,
  intent: PaymentIntent,
  txHash: Hex32,
  chain: PaymentChain,
): Promise<PaymentResult> {
  const amount = parseUsdc(intent.amountUsdc);
  const mandate = BigInt(mandateId);
  const receipt = await chain.waitForReceipt(txHash);
  validateReceiptEnvelope(receipt, context);
  if (receipt.status === 'reverted') {
    return result(requestId, 'technical_failure', txHash, null, amount, null);
  }

  const event = findOutcomeEvent(receipt, context.account, requestId, mandate);
  if (event !== null) {
    if (event.eventName === 'Executed') {
      if (
        event.args.agent.toLowerCase() !== context.agentAddress.toLowerCase() ||
        event.args.recipient.toLowerCase() !== intent.recipient.toLowerCase() ||
        event.args.amount !== amount
      ) {
        throw new PaymentIntegrityError('Executed event payload mismatch');
      }
      return result(requestId, 'executed', txHash, 'NONE', amount, event.args.headroom);
    }
    if (
      event.args.agent.toLowerCase() !== context.agentAddress.toLowerCase() ||
      event.args.recipient.toLowerCase() !== intent.recipient.toLowerCase() ||
      event.args.attempted !== amount
    ) {
      throw new PaymentIntegrityError('Refused event payload mismatch');
    }
    return result(
      requestId,
      'refused',
      txHash,
      RULES[event.args.rule] ?? 'UNKNOWN',
      amount,
      event.args.headroom,
    );
  }

  const stored = await chain.readRequest(context.account, mandate, requestId);
  if (
    stored.agent.toLowerCase() !== context.agentAddress.toLowerCase() ||
    stored.recipient.toLowerCase() !== intent.recipient.toLowerCase() ||
    stored.attempted !== amount
  ) {
    throw new PaymentIntegrityError('Stored request payload mismatch');
  }
  if (stored.outcome === 1) {
    return result(requestId, 'executed', txHash, 'NONE', amount, stored.headroom);
  }
  if (stored.outcome === 2) {
    return result(
      requestId,
      'refused',
      txHash,
      RULES[stored.rule] ?? 'UNKNOWN',
      amount,
      stored.headroom,
    );
  }
  throw new PaymentIntegrityError('Successful receipt has no persisted outcome');
}

function validateReceiptEnvelope(receipt: ConfirmedReceipt, context: VerifiedAgentContext): void {
  if (
    receipt.to?.toLowerCase() !== context.account.toLowerCase() ||
    receipt.from.toLowerCase() !== context.agentAddress.toLowerCase()
  ) {
    throw new PaymentIntegrityError('Receipt sender or destination mismatch');
  }
}

function findOutcomeEvent(
  receipt: ConfirmedReceipt,
  account: VerifiedAgentContext['account'],
  requestId: Hex32,
  mandateId: bigint,
) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== account.toLowerCase()) continue;
    if (log.topics.length === 0) continue;
    try {
      const topics = [...log.topics] as [`0x${string}`, ...`0x${string}`[]];
      const decoded = decodeEventLog({ abi: golAccountAbi, data: log.data, topics });
      if (
        (decoded.eventName === 'Executed' || decoded.eventName === 'Refused') &&
        decoded.args.requestId.toLowerCase() === requestId.toLowerCase() &&
        decoded.args.mandateId === mandateId
      ) {
        return decoded;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function result(
  requestId: Hex32,
  state: PaymentResult['state'],
  txHash: Hex32 | null,
  rule: string | null,
  amount: bigint,
  headroom: bigint | null,
): PaymentResult {
  return {
    requestId,
    state,
    txHash,
    rule,
    attemptedUnits: amount.toString(),
    headroomUnits: headroom?.toString() ?? null,
    indexed: false,
  };
}
