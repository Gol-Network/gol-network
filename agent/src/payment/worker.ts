import {
  formatUsdc,
  parseUsdc,
  type PaymentIntent,
  type RecipientLabel,
  type VerifiedAgentContext,
} from '@gol/protocol';
import type { JournalRequest } from '../db/journal.js';
import type { JsonModel } from '../model/types.js';
import { parseInstruction } from './parse-instruction.js';
import { reconcilePayment } from './submit-payment.js';
import { SignerPolicyError, type PaymentChain, type ScopedAgentSigner } from './types.js';

export interface WorkerContext {
  context: VerifiedAgentContext;
  recipients: RecipientLabel[];
  signer: ScopedAgentSigner;
  chain: PaymentChain;
  model?: JsonModel;
}

export interface WorkerContextResolver {
  resolve(job: JournalRequest): Promise<WorkerContext>;
}

export interface WorkerJournal {
  claimNext(workerId: string): Promise<JournalRequest | null>;
  markSigning(
    id: string,
    workerId: string,
    recipient: `0x${string}`,
    amountUnits: string,
  ): Promise<void>;
  recordSubmission(
    id: string,
    workerId: string,
    providerOperationId: string | null,
    txHash: `0x${string}`,
  ): Promise<void>;
  finish(
    id: string,
    workerId: string,
    result: {
      state:
        | 'needs_clarification'
        | 'executed'
        | 'refused'
        | 'signer_blocked'
        | 'technical_failure'
        | 'unknown';
      rule?: string | null;
      attemptedUnits?: string | null;
      headroomUnits?: string | null;
      errorCode?: string | null;
    },
  ): Promise<void>;
}

export class PaymentWorker {
  constructor(
    private readonly workerId: string,
    private readonly journal: WorkerJournal,
    private readonly resolver: WorkerContextResolver,
  ) {}

  async tick(): Promise<boolean> {
    const job = await this.journal.claimNext(this.workerId);
    if (!job) return false;
    const dependencies = await this.resolver.resolve(job);

    // Any known provider result is reconciled before a submission is considered.
    if (job.txHash) {
      await this.reconcile(job, dependencies, job.txHash);
      return true;
    }
    if (job.providerOperationId) {
      const submission = await dependencies.signer.getSubmission(job.providerOperationId);
      if (!submission) {
        await this.journal.finish(job.id, this.workerId, {
          state: 'unknown',
          errorCode: 'PROVIDER_STATUS_UNKNOWN',
        });
        return true;
      }
      await this.journal.recordSubmission(
        job.id,
        this.workerId,
        submission.providerOperationId,
        submission.txHash,
      );
      await this.reconcile(job, dependencies, submission.txHash);
      return true;
    }

    // A request marked signing lost the provider response before it was persisted. The stored
    // intent is replayed under the same request ID, so Privy's idempotency key converges on the
    // original operation instead of creating a second business request.
    if (job.state === 'signing') {
      const intent = storedIntent(job);
      if (!intent) {
        await this.journal.finish(job.id, this.workerId, {
          state: 'unknown',
          errorCode: 'AMBIGUOUS_SIGNING_STATE',
        });
        return true;
      }
      await this.submit(job, dependencies, intent);
      return true;
    }

    if (job.state !== 'queued') {
      await this.journal.finish(job.id, this.workerId, {
        state: 'unknown',
        errorCode: 'AMBIGUOUS_SIGNING_STATE',
      });
      return true;
    }

    const parsed = await parseInstruction(job.text, dependencies.recipients, dependencies.model);
    if (parsed.kind === 'clarification') {
      await this.journal.finish(job.id, this.workerId, {
        state: 'needs_clarification',
        errorCode: parsed.message,
      });
      return true;
    }
    const amount = parseUsdc(parsed.intent.amountUsdc);
    await this.journal.markSigning(
      job.id,
      this.workerId,
      parsed.intent.recipient,
      amount.toString(),
    );
    await this.submit(job, dependencies, parsed.intent);
    return true;
  }

  private async submit(
    job: JournalRequest,
    dependencies: WorkerContext,
    intent: PaymentIntent,
  ): Promise<void> {
    try {
      const { createPaymentTransaction } = await import('./submit-transaction.js');
      const transaction = createPaymentTransaction(
        dependencies.context,
        job.requestId,
        job.mandateId,
        intent,
      );
      const submission = await dependencies.signer.sendTransaction(transaction);
      await this.journal.recordSubmission(
        job.id,
        this.workerId,
        submission.providerOperationId,
        submission.txHash,
      );
      await this.reconcile(job, dependencies, submission.txHash, intent);
    } catch (error) {
      await this.journal.finish(job.id, this.workerId, {
        state: error instanceof SignerPolicyError ? 'signer_blocked' : 'unknown',
        errorCode: error instanceof SignerPolicyError ? 'SIGNER_BLOCKED' : 'SUBMISSION_AMBIGUOUS',
      });
    }
  }

  private async reconcile(
    job: JournalRequest,
    dependencies: WorkerContext,
    txHash: `0x${string}`,
    intent?: PaymentIntent,
  ): Promise<void> {
    const resolvedIntent = intent ?? recoveredIntent(job);
    try {
      const result = await reconcilePayment(
        dependencies.context,
        job.requestId,
        job.mandateId,
        resolvedIntent,
        txHash,
        dependencies.chain,
      );
      await this.journal.finish(job.id, this.workerId, {
        state: result.state === 'executed' || result.state === 'refused' ? result.state : 'unknown',
        rule: result.rule,
        attemptedUnits: result.attemptedUnits,
        headroomUnits: result.headroomUnits,
      });
    } catch {
      await this.journal.finish(job.id, this.workerId, {
        state: 'unknown',
        errorCode: 'RECONCILIATION_PENDING',
      });
    }
  }
}

function storedIntent(job: JournalRequest): PaymentIntent | null {
  if (!job.parsedRecipient || !job.parsedAmount) return null;
  return { recipient: job.parsedRecipient, amountUsdc: formatUsdc(BigInt(job.parsedAmount)) };
}

function recoveredIntent(job: JournalRequest): PaymentIntent {
  const intent = storedIntent(job);
  if (!intent) throw new Error('Stored payment intent is missing');
  return intent;
}
