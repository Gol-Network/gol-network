import type { PaymentStage, TransactionPhase } from './types';

interface StageCopy {
  label: string;
  detail: string;
  terminal: boolean;
}

/**
 * Every durable stage is rendered with its own words. Status is never carried by colour alone.
 */
export const PAYMENT_STAGES: Record<PaymentStage, StageCopy> = {
  idle: { label: 'IDLE', detail: 'No instruction has been submitted.', terminal: true },
  parsing: {
    label: 'PARSING',
    detail: 'Resolving one amount and one approved recipient.',
    terminal: false,
  },
  needs_clarification: {
    label: 'NEEDS CLARIFICATION',
    detail: 'No transaction was submitted. Restate one amount and one approved recipient.',
    terminal: true,
  },
  queued: { label: 'QUEUED', detail: 'Recorded in the durable payment journal.', terminal: false },
  signing: {
    label: 'SIGNING',
    detail: 'The restricted agent signer was asked to submit this request.',
    terminal: false,
  },
  submitted: {
    label: 'SUBMITTED',
    detail: 'Broadcast to Arc testnet. A receipt is not an outcome yet.',
    terminal: false,
  },
  confirming: {
    label: 'CONFIRMING',
    detail: 'Waiting for the receipt that decides the contract outcome.',
    terminal: false,
  },
  executed: {
    label: 'EXECUTED',
    detail: 'The account contract released the payment.',
    terminal: true,
  },
  refused: {
    label: 'REFUSED',
    detail: 'The transaction succeeded on-chain and the account contract refused the payment.',
    terminal: true,
  },
  signer_blocked: {
    label: 'SIGNER BLOCKED',
    detail: 'The restricted Privy signer rejected the request before it was broadcast.',
    terminal: true,
  },
  technical_failure: {
    label: 'TECHNICAL FAILURE',
    detail: 'The transaction reverted. No contract outcome was recorded.',
    terminal: true,
  },
  unknown: {
    label: 'UNKNOWN',
    detail: 'The provider or receipt state is unresolved. This is not a failure.',
    terminal: true,
  },
};

const JOURNAL_TO_STAGE: Record<string, PaymentStage> = {
  queued: 'queued',
  needs_clarification: 'needs_clarification',
  signing: 'signing',
  submitted: 'submitted',
  pending: 'confirming',
  executed: 'executed',
  refused: 'refused',
  signer_blocked: 'signer_blocked',
  technical_failure: 'technical_failure',
  unknown: 'unknown',
};

export function stageFromJournal(state: string): PaymentStage {
  return JOURNAL_TO_STAGE[state] ?? 'unknown';
}

export function isTerminalStage(stage: PaymentStage): boolean {
  return PAYMENT_STAGES[stage].terminal;
}

export const TRANSACTION_PHASES: Record<TransactionPhase, string> = {
  idle: 'Ready',
  awaiting_signature: 'Awaiting your wallet signature',
  submitted: 'Submitted to Arc testnet',
  confirmed: 'Confirmed on Arc testnet',
  rejected: 'You rejected the signature. Nothing changed.',
  reverted: 'The transaction reverted on-chain.',
  insufficient_gas: 'Not enough gas in the signing wallet.',
  failed: 'The transaction could not be completed.',
};
