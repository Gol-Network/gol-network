import {
  formatUsdc,
  golAccountAbi,
  parseUsdc,
  type Address,
  type Hex32,
  type PaymentIntent,
  type RecipientLabel,
  type VerifiedAgentContext,
} from '@gol/protocol';
import { encodeFunctionData, keccak256, toHex } from 'viem';
import type { JournalRequest } from '../db/journal.js';
import type { JsonModel } from '../model/types.js';
import {
  validateSignerEnvelope,
  type AgentSigner,
  type UnsignedEip1559Transaction,
} from '../signers/index.js';
import { parseInstruction } from './parse-instruction.js';
import { reconcilePayment } from './submit-payment.js';
import { createPaymentTransaction } from './submit-transaction.js';
import {
  BroadcastAmbiguousError,
  NonceTooLowError,
  SignerConfigurationError,
  SignerPolicyError,
  type PaymentChain,
  type ScopedAgentSigner,
} from './types.js';

export interface KmsExecutionConfig {
  keyArn: string;
  maxGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  /** Multiplier applied to the bounded gas estimate, e.g. 1.25. */
  gasMargin: number;
}

interface WorkerContextBase {
  context: VerifiedAgentContext;
  recipients: RecipientLabel[];
  chain: PaymentChain;
  model?: JsonModel;
}

export type WorkerContext =
  | (WorkerContextBase & { mode: 'privy'; signer: ScopedAgentSigner })
  | (WorkerContextBase & { mode: 'aws_kms'; signer: AgentSigner; kms: KmsExecutionConfig });

export interface WorkerContextResolver {
  resolve(job: JournalRequest): Promise<WorkerContext>;
}

export interface WorkerJournal {
  claimNext(workerId: string): Promise<JournalRequest | null>;
  markSigning(id: string, workerId: string, recipient: Address, amountUnits: string): Promise<void>;
  recordSubmission(
    id: string,
    workerId: string,
    providerOperationId: string | null,
    txHash: Hex32,
  ): Promise<void>;
  prepareSigning(input: {
    id: string;
    workerId: string;
    signerAddress: Address;
    recipient: Address;
    amountUnits: string;
    unsignedIntentHash: string;
    readPendingNonce: () => Promise<number>;
  }): Promise<{ nonce: number; reused: boolean }>;
  recordSigned(input: {
    id: string;
    workerId: string;
    txHash: Hex32;
    rawTransaction: string;
    signingKeyArn: string;
  }): Promise<void>;
  recordBroadcast(id: string, workerId: string): Promise<void>;
  recordBroadcastError(id: string, workerId: string, error: string): Promise<void>;
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
    if (dependencies.mode === 'aws_kms') {
      await this.runKms(job, dependencies);
    } else {
      await this.runPrivy(job, dependencies);
    }
    return true;
  }

  // -----------------------------------------------------------------------------------------------
  // AWS KMS: persist-before-broadcast state machine.
  // -----------------------------------------------------------------------------------------------

  private async runKms(
    job: JournalRequest,
    deps: WorkerContext & { mode: 'aws_kms' },
  ): Promise<void> {
    // After raw-transaction persistence, always reuse the exact bytes; never re-sign.
    if (job.signedRawTransaction) {
      await this.rebroadcastAndReconcile(job, deps, job.signedRawTransaction);
      return;
    }

    // A known hash without stored bytes (legacy or provider path) still reconciles by local hash.
    if (job.txHash) {
      await this.reconcileKms(job, deps, job.txHash);
      return;
    }

    // `signing_prepared` with no signed artifact: safe to (re)build and (re)sign under the reserved
    // nonce, because nothing was broadcast.
    if (job.state === 'signing_prepared') {
      const intent = storedIntent(job);
      if (!intent || job.txNonce === null) {
        await this.journal.finish(job.id, this.workerId, {
          state: 'unknown',
          errorCode: 'AMBIGUOUS_SIGNING_STATE',
        });
        return;
      }
      await this.constructSignBroadcast(job, deps, intent, Number(job.txNonce));
      return;
    }

    if (job.state !== 'queued') {
      await this.journal.finish(job.id, this.workerId, {
        state: 'unknown',
        errorCode: 'AMBIGUOUS_SIGNING_STATE',
      });
      return;
    }

    const parsed = await parseInstruction(job.text, deps.recipients, deps.model);
    if (parsed.kind === 'clarification') {
      await this.journal.finish(job.id, this.workerId, {
        state: 'needs_clarification',
        errorCode: parsed.message,
      });
      return;
    }

    const amount = parseUsdc(parsed.intent.amountUsdc);
    const signerAddress = await deps.signer.getAddress();
    const unsignedIntentHash = intentHash(deps.context, job, parsed.intent.recipient, amount);

    const { nonce } = await this.journal.prepareSigning({
      id: job.id,
      workerId: this.workerId,
      signerAddress,
      recipient: parsed.intent.recipient,
      amountUnits: amount.toString(),
      unsignedIntentHash,
      readPendingNonce: () => deps.chain.pendingNonce(signerAddress),
    });

    await this.constructSignBroadcast(job, deps, parsed.intent, nonce);
  }

  private async constructSignBroadcast(
    job: JournalRequest,
    deps: WorkerContext & { mode: 'aws_kms' },
    intent: PaymentIntent,
    nonce: number,
  ): Promise<void> {
    const amount = parseUsdc(intent.amountUsdc);
    const signerAddress = await deps.signer.getAddress();

    // Live mandate check: the configured signer must be the active mandate's agent and it must be
    // usable. An over-limit amount is deliberately allowed through so the contract records a refusal.
    const onChainMandateId = await deps.chain.readActiveMandateId(deps.context.account);
    if (onChainMandateId.toString() !== job.mandateId) {
      await this.journal.finish(job.id, this.workerId, {
        state: 'signer_blocked',
        errorCode: 'MANDATE_NOT_ACTIVE',
        attemptedUnits: amount.toString(),
      });
      return;
    }
    const mandate = await deps.chain.readMandate(deps.context.account, onChainMandateId);
    if (
      !mandate.exists ||
      mandate.revoked ||
      mandate.agent.toLowerCase() !== signerAddress.toLowerCase()
    ) {
      await this.journal.finish(job.id, this.workerId, {
        state: 'signer_blocked',
        errorCode: 'MANDATE_AGENT_MISMATCH',
        attemptedUnits: amount.toString(),
      });
      return;
    }

    const data = encodeFunctionData({
      abi: golAccountAbi,
      functionName: 'pay',
      args: [BigInt(job.mandateId), job.requestId, intent.recipient, amount],
    });

    const fees = await deps.chain.feeParameters();
    const maxFeePerGas = min(fees.maxFeePerGas, deps.kms.maxFeePerGas);
    const maxPriorityFeePerGas = min(
      min(fees.maxPriorityFeePerGas, deps.kms.maxPriorityFeePerGas),
      maxFeePerGas,
    );

    let gas: bigint;
    try {
      const estimate = await deps.chain.estimatePayGas({
        from: signerAddress,
        to: deps.context.account,
        data,
      });
      gas = withMargin(estimate, deps.kms.gasMargin);
    } catch {
      gas = deps.kms.maxGas;
    }
    if (gas > deps.kms.maxGas) gas = deps.kms.maxGas;

    const balance = await deps.chain.nativeBalance(signerAddress);
    if (balance < gas * maxFeePerGas) {
      await this.journal.finish(job.id, this.workerId, {
        state: 'signer_blocked',
        errorCode: 'AGENT_GAS_INSUFFICIENT',
        attemptedUnits: amount.toString(),
      });
      return;
    }

    const transaction: UnsignedEip1559Transaction = {
      type: 'eip1559',
      chainId: 5042002,
      nonce,
      to: deps.context.account,
      value: 0n,
      data,
      gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      accessList: [],
    };

    try {
      validateSignerEnvelope(transaction, {
        chainId: 5042002,
        configuredSender: signerAddress,
        signerAddress,
        account: deps.context.account,
        mandateId: BigInt(job.mandateId),
        onChainMandateId,
        requestId: job.requestId,
        recipient: intent.recipient,
        amount,
        maxGas: deps.kms.maxGas,
        maxFeePerGasCeiling: deps.kms.maxFeePerGas,
        maxPriorityFeePerGasCeiling: deps.kms.maxPriorityFeePerGas,
      });
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'ENVELOPE';
      logJson({ event: 'signer_envelope_rejected', requestId: job.requestId, errorCode: code });
      await this.journal.finish(job.id, this.workerId, {
        state: 'signer_blocked',
        errorCode: 'SIGNER_ENVELOPE_REJECTED',
        attemptedUnits: amount.toString(),
      });
      return;
    }

    const signed = await deps.signer.signTransaction(transaction);
    // Atomic: persist the exact bytes and local hash before any network broadcast.
    await this.journal.recordSigned({
      id: job.id,
      workerId: this.workerId,
      txHash: signed.transactionHash,
      rawTransaction: signed.rawTransaction,
      signingKeyArn: deps.kms.keyArn,
    });

    await this.rebroadcastAndReconcile(job, deps, signed.rawTransaction, intent);
  }

  private async rebroadcastAndReconcile(
    job: JournalRequest,
    deps: WorkerContext & { mode: 'aws_kms' },
    rawTransaction: string,
    intent?: PaymentIntent,
  ): Promise<void> {
    let txHash: Hex32;
    try {
      const result = await deps.chain.broadcastRawTransaction(rawTransaction as `0x${string}`);
      txHash = result.txHash;
      await this.journal.recordBroadcast(job.id, this.workerId);
    } catch (error) {
      if (error instanceof NonceTooLowError) {
        // The nonce is already mined. Reconcile the locally calculated hash and on-chain state;
        // never fabricate a new transaction.
        const localHash = keccak256(rawTransaction as `0x${string}`);
        await this.reconcileKms(job, deps, localHash, 'NONCE_TOO_LOW', intent);
        return;
      }
      if (error instanceof BroadcastAmbiguousError) {
        await this.journal.recordBroadcastError(job.id, this.workerId, error.code);
        await this.journal.finish(job.id, this.workerId, {
          state: 'unknown',
          errorCode: 'BROADCAST_AMBIGUOUS',
        });
        return;
      }
      throw error;
    }
    await this.reconcileKms(job, deps, txHash, undefined, intent);
  }

  private async reconcileKms(
    job: JournalRequest,
    deps: WorkerContext & { mode: 'aws_kms' },
    txHash: Hex32,
    note?: string,
    providedIntent?: PaymentIntent,
  ): Promise<void> {
    const intent = providedIntent ?? storedIntent(job);
    if (!intent) {
      await this.journal.finish(job.id, this.workerId, {
        state: 'unknown',
        errorCode: note ?? 'RECONCILIATION_PENDING',
      });
      return;
    }
    try {
      const result = await reconcilePayment(
        deps.context,
        job.requestId,
        job.mandateId,
        intent,
        txHash,
        deps.chain,
      );
      await this.journal.finish(job.id, this.workerId, {
        state: result.state === 'executed' || result.state === 'refused' ? result.state : 'unknown',
        rule: result.rule,
        attemptedUnits: result.attemptedUnits,
        headroomUnits: result.headroomUnits,
        ...(result.state === 'executed' || result.state === 'refused'
          ? {}
          : { errorCode: note ?? 'RECONCILIATION_PENDING' }),
      });
    } catch {
      await this.journal.finish(job.id, this.workerId, {
        state: 'unknown',
        errorCode: note ?? 'RECONCILIATION_PENDING',
      });
    }
  }

  // -----------------------------------------------------------------------------------------------
  // Privy: retained provider path. Historical behavior is unchanged.
  // -----------------------------------------------------------------------------------------------

  private async runPrivy(
    job: JournalRequest,
    dependencies: WorkerContext & { mode: 'privy' },
  ): Promise<void> {
    if (job.txHash) {
      await this.reconcile(job, dependencies, job.txHash);
      return;
    }
    if (job.providerOperationId) {
      const submission = await dependencies.signer.getSubmission(job.providerOperationId);
      if (!submission) {
        await this.journal.finish(job.id, this.workerId, {
          state: 'unknown',
          errorCode: 'PROVIDER_STATUS_UNKNOWN',
        });
        return;
      }
      await this.journal.recordSubmission(
        job.id,
        this.workerId,
        submission.providerOperationId,
        submission.txHash,
      );
      await this.reconcile(job, dependencies, submission.txHash);
      return;
    }

    if (job.state === 'signing') {
      const intent = storedIntent(job);
      if (!intent) {
        await this.journal.finish(job.id, this.workerId, {
          state: 'unknown',
          errorCode: 'AMBIGUOUS_SIGNING_STATE',
        });
        return;
      }
      await this.submitPrivy(job, dependencies, intent);
      return;
    }

    if (job.state !== 'queued') {
      await this.journal.finish(job.id, this.workerId, {
        state: 'unknown',
        errorCode: 'AMBIGUOUS_SIGNING_STATE',
      });
      return;
    }

    const parsed = await parseInstruction(job.text, dependencies.recipients, dependencies.model);
    if (parsed.kind === 'clarification') {
      await this.journal.finish(job.id, this.workerId, {
        state: 'needs_clarification',
        errorCode: parsed.message,
      });
      return;
    }
    const amount = parseUsdc(parsed.intent.amountUsdc);
    await this.journal.markSigning(
      job.id,
      this.workerId,
      parsed.intent.recipient,
      amount.toString(),
    );
    await this.submitPrivy(job, dependencies, parsed.intent);
  }

  private async submitPrivy(
    job: JournalRequest,
    dependencies: WorkerContext & { mode: 'privy' },
    intent: PaymentIntent,
  ): Promise<void> {
    const transaction = createPaymentTransaction(
      dependencies.context,
      job.requestId,
      job.mandateId,
      intent,
    );
    let submission;
    try {
      submission = await dependencies.signer.sendTransaction(transaction);
    } catch (error) {
      const signerBlocked =
        error instanceof SignerPolicyError || error instanceof SignerConfigurationError;
      const errorCode =
        error instanceof SignerPolicyError || error instanceof SignerConfigurationError
          ? error.code
          : 'SUBMISSION_AMBIGUOUS';
      logJson({
        event: 'payment_submission_failed',
        requestId: job.requestId,
        errorCode,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      await this.journal.finish(job.id, this.workerId, {
        state: signerBlocked ? 'signer_blocked' : 'unknown',
        errorCode,
      });
      return;
    }

    await this.journal.recordSubmission(
      job.id,
      this.workerId,
      submission.providerOperationId,
      submission.txHash,
    );
    await this.reconcile(job, dependencies, submission.txHash, intent);
  }

  private async reconcile(
    job: JournalRequest,
    dependencies: WorkerContext,
    txHash: Hex32,
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

function intentHash(
  context: VerifiedAgentContext,
  job: JournalRequest,
  recipient: Address,
  amount: bigint,
): string {
  return keccak256(
    toHex(
      JSON.stringify([
        context.chainId,
        context.account.toLowerCase(),
        job.mandateId,
        job.requestId.toLowerCase(),
        recipient.toLowerCase(),
        amount.toString(),
      ]),
    ),
  );
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function withMargin(value: bigint, margin: number): bigint {
  const scaled = Math.round(margin * 1000);
  return (value * BigInt(scaled)) / 1000n;
}

function logJson(payload: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify(payload)}\n`);
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
