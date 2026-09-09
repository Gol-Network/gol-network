import {
  formatUsdc,
  parseUsdc,
  type ActivityPage,
  type ActivityRecord,
  type Address,
  type GroundedAnswer,
} from '@gol/protocol';
import { parseInstruction } from '@gol/agent/instruction';
import type { PublicConfig } from '@/config';
import type {
  AccountSnapshot,
  GolBackend,
  MandateDraft,
  RequestSnapshot,
  TransactionReporter,
} from './types';

const OWNER = '0xC0FFEe0000000000000000000000000000000001' as Address;
const ACCOUNT = '0xACc0170000000000000000000000000000000002' as Address;
const AGENT = '0xA6e1700000000000000000000000000000000003' as Address;
const RECIPIENT = '0xbEef000000000000000000000000000000000004' as Address;

/** Deliberately short so the mocked flow passes through every state without stalling a demo. */
const TIMINGS = {
  signature: 180,
  confirmation: 320,
  provisioning: 320,
  queued: 200,
  signing: 400,
  submitted: 700,
  confirming: 1_000,
  indexing: 4_000,
};

interface FixtureRequest {
  requestId: string;
  mandateId: string;
  submittedAt: number;
  recipient: Address | null;
  amountUnits: string | null;
  txHash: string | null;
  terminal: 'executed' | 'refused' | 'needs_clarification';
  rule: string | null;
  headroomUnits: string | null;
  errorCode: string | null;
  indexed: ActivityRecord | null;
}

function pause(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function hash(seed: number): `0x${string}` {
  return `0x${seed.toString(16).padStart(64, '0')}`;
}

/**
 * A labeled fixture provider. It never touches a chain, a signer, or a paid model, and it drives
 * the same backend interface the live application uses so the mocked run exercises the same
 * interface states as a real payment.
 */
export function createFixtureBackend(config: PublicConfig): GolBackend {
  let nonce = 1;
  let accountCreated = false;
  let agentProvisioned = false;
  let agentGasWei = 0n;
  let accountUsdc = 0n;
  let activeMandateId = '0';
  let spent = 0n;
  let mandate: AccountSnapshot['mandate'] = null;
  let sequence = 0;
  let indexedBlock = 61_061_383;
  const requests = new Map<string, FixtureRequest>();
  const indexedRecords: ActivityRecord[] = [];

  const cap = BigInt(config.accountTargetUnits);

  async function ownerTransaction(report: TransactionReporter, apply: () => void) {
    report({ phase: 'awaiting_signature' });
    await pause(TIMINGS.signature);
    const txHash = hash(nonce++);
    report({ phase: 'submitted', hash: txHash });
    await pause(TIMINGS.confirmation);
    apply();
    report({ phase: 'confirmed', hash: txHash });
  }

  function snapshot(): AccountSnapshot {
    return {
      ownerAddress: OWNER,
      accountAddress: accountCreated ? ACCOUNT : null,
      agentAddress: agentProvisioned ? AGENT : null,
      linked: agentProvisioned,
      policyId: agentProvisioned ? 'fixture-policy' : null,
      policyDisclosure: agentProvisioned
        ? {
            purpose: 'Submit GOL payment requests to your account contract and nothing else.',
            policyName: `GOL ${ACCOUNT.slice(0, 10)} zero-value account calls`,
            chain: `eip155:${config.chainId}`,
            chainId: config.chainId,
            destination: ACCOUNT,
            allowedMethod: 'eth_sendTransaction',
            nativeValue: '0',
            defaultAction: 'DENY',
            calldataRestricted: false,
            revocation: 'Revoke the mandate from the owner wallet.',
          }
        : null,
      recipients: agentProvisioned ? [{ address: RECIPIENT, label: config.recipientLabel }] : [],
      balances: {
        ownerUsdcUnits: (250n * 10n ** 6n).toString(),
        accountUsdcUnits: accountUsdc.toString(),
        // The fixture owner starts with enough native gas to complete the checklist.
        ownerGasWei: (5n * 10n ** 18n).toString(),
        agentGasWei: agentGasWei.toString(),
      },
      activeMandateId,
      mandate,
    };
  }

  function record(request: FixtureRequest): ActivityRecord {
    sequence += 1;
    indexedBlock += 2;
    const executed = request.terminal === 'executed';
    return {
      actionId: `${request.txHash}${sequence.toString(16).padStart(8, '0')}` as `0x${string}`,
      requestId: request.requestId as `0x${string}`,
      mandateId: request.mandateId,
      agent: AGENT,
      recipient: RECIPIENT,
      outcome: executed ? 'EXECUTED' : 'REFUSED',
      rule: executed ? 'NONE' : 'CUMULATIVE_CAP',
      reason: executed ? 'Payment executed' : 'Cumulative cap exceeded',
      attempted: request.amountUnits ?? '0',
      transferred: executed ? (request.amountUnits ?? '0') : '0',
      headroom: request.headroomUnits ?? '0',
      spentAfter: spent.toString(),
      sequence: String(sequence),
      transactionHash: request.txHash as `0x${string}`,
      blockNumber: String(indexedBlock),
      blockHash: hash(indexedBlock),
      timestamp: String(Math.floor(Date.now() / 1_000)),
      logIndex: '0',
    };
  }

  return {
    async loadAccount() {
      return snapshot();
    },

    async ownerGasWei() {
      return (5n * 10n ** 18n).toString();
    },

    async createAccount(report) {
      await ownerTransaction(report, () => {
        accountCreated = true;
      });
    },

    async provisionAgent() {
      await pause(TIMINGS.provisioning);
      agentProvisioned = true;
    },

    async fundAgentGas(_agent, units, report) {
      await ownerTransaction(report, () => {
        // On Arc the ERC-20 transfer and the native gas view describe one balance.
        agentGasWei += units * 10n ** 12n;
      });
    },

    async fundAccount(_account, units, report) {
      await ownerTransaction(report, () => {
        accountUsdc += units;
      });
    },

    async signMandate(_account, draft: MandateDraft, report) {
      await ownerTransaction(report, () => {
        activeMandateId = '1';
        spent = 0n;
        mandate = {
          perPaymentCapUnits: draft.perPaymentCapUnits,
          cumulativeCapUnits: draft.cumulativeCapUnits,
          spentUnits: '0',
          expiresAt: draft.expiresAt,
          revoked: false,
        };
      });
    },

    async revokeMandate(_account, _mandateId, report) {
      await ownerTransaction(report, () => {
        if (mandate) mandate = { ...mandate, revoked: true };
        activeMandateId = '0';
      });
    },

    async withdraw(_account, units, report) {
      await ownerTransaction(report, () => {
        accountUsdc = accountUsdc > units ? accountUsdc - units : 0n;
      });
    },

    async submitInstruction(_account, requestId, text, mandateId) {
      const parsed = await parseInstruction(text, [
        { address: RECIPIENT, label: config.recipientLabel },
      ]);
      if (parsed.kind === 'clarification') {
        requests.set(requestId, {
          requestId,
          mandateId,
          submittedAt: Date.now(),
          recipient: null,
          amountUnits: null,
          txHash: null,
          terminal: 'needs_clarification',
          rule: null,
          headroomUnits: null,
          errorCode: parsed.message,
          indexed: null,
        });
        return;
      }
      const amount = parseUsdc(parsed.intent.amountUsdc);
      const remaining = cap - spent;
      const refused = amount > remaining;
      if (!refused) spent += amount;
      requests.set(requestId, {
        requestId,
        mandateId,
        submittedAt: Date.now(),
        recipient: parsed.intent.recipient,
        amountUnits: amount.toString(),
        txHash: hash(nonce++),
        terminal: refused ? 'refused' : 'executed',
        rule: refused ? 'CUMULATIVE_CAP' : 'NONE',
        headroomUnits: (refused ? remaining : cap - spent).toString(),
        errorCode: null,
        indexed: null,
      });
      if (!refused) {
        accountUsdc = accountUsdc > amount ? accountUsdc - amount : 0n;
      }
      if (mandate) mandate = { ...mandate, spentUnits: spent.toString() };
    },

    async getRequest(requestId): Promise<RequestSnapshot> {
      const request = requests.get(requestId);
      if (!request) throw new Error('REQUEST_NOT_FOUND');
      const elapsed = Date.now() - request.submittedAt;
      const base = {
        requestId,
        account: ACCOUNT,
        mandateId: request.mandateId,
        recipient: request.recipient,
        amountUnits: request.amountUnits,
        rule: null as string | null,
        attemptedUnits: request.amountUnits,
        headroomUnits: null as string | null,
        errorCode: null as string | null,
      };
      if (request.terminal === 'needs_clarification') {
        return elapsed < TIMINGS.queued
          ? { ...base, state: 'queued', txHash: null, explorerUrl: null }
          : {
              ...base,
              state: 'needs_clarification',
              txHash: null,
              explorerUrl: null,
              errorCode: request.errorCode,
            };
      }
      if (elapsed < TIMINGS.queued) {
        return { ...base, state: 'queued', txHash: null, explorerUrl: null };
      }
      if (elapsed < TIMINGS.signing) {
        return { ...base, state: 'signing', txHash: null, explorerUrl: null };
      }
      const txHash = request.txHash;
      const explorerUrl = `${config.explorerUrl.replace(/\/$/, '')}/tx/${txHash}`;
      if (elapsed < TIMINGS.submitted) {
        return { ...base, state: 'submitted', txHash, explorerUrl };
      }
      if (elapsed < TIMINGS.confirming) {
        return { ...base, state: 'pending', txHash, explorerUrl };
      }
      if (!request.indexed && elapsed >= TIMINGS.indexing) {
        request.indexed = record(request);
        indexedRecords.unshift(request.indexed);
      }
      return {
        ...base,
        state: request.terminal,
        txHash,
        explorerUrl,
        rule: request.rule,
        headroomUnits: request.headroomUnits,
      };
    },

    async getActivity(): Promise<ActivityPage> {
      for (const request of requests.values()) {
        if (
          !request.indexed &&
          request.terminal !== 'needs_clarification' &&
          Date.now() - request.submittedAt >= TIMINGS.indexing
        ) {
          request.indexed = record(request);
          indexedRecords.unshift(request.indexed);
        }
      }
      return {
        records: [...indexedRecords],
        cursor: null,
        indexedBlock: String(indexedBlock),
        indexedBlockHash: hash(indexedBlock),
        indexedAt: String(Math.floor(Date.now() / 1_000)),
        chainHeadBlock: String(indexedBlock + 1),
        hasIndexingErrors: false,
        freshness: 'current',
        sourceDeployment: 'fixture-deployment',
        partial: false,
      };
    },

    async ask(_account, question): Promise<GroundedAnswer> {
      const page = await this.getActivity(ACCOUNT);
      const asksRefusal = /refus|denied|why|cap|limit/i.test(question);
      const records = page.records.filter((entry) => !asksRefusal || entry.outcome === 'REFUSED');
      if (records.length === 0) {
        return {
          status: 'empty',
          text: `No matching records indexed through block ${page.indexedBlock}.`,
          citations: [],
          indexedBlock: page.indexedBlock,
          indexedAt: page.indexedAt,
          sourceDeployment: page.sourceDeployment,
          freshness: page.freshness,
          recordCount: 0,
          partial: false,
          deterministic: true,
        };
      }
      const selected = records[0]!;
      const text =
        selected.outcome === 'REFUSED'
          ? `${formatUsdc(BigInt(selected.attempted))} USDC was refused because the amount exceeded the remaining cumulative cap. ${formatUsdc(BigInt(selected.headroom))} USDC remained after ${formatUsdc(BigInt(selected.spentAfter))} USDC had been spent.`
          : `${formatUsdc(BigInt(selected.transferred))} USDC was executed, leaving ${formatUsdc(BigInt(selected.headroom))} USDC of mandate headroom.`;
      return {
        status: 'answer',
        text,
        citations: records.map((entry) => ({
          actionId: entry.actionId,
          txHash: entry.transactionHash,
          logIndex: entry.logIndex,
          explorerUrl: `${config.explorerUrl.replace(/\/$/, '')}/tx/${entry.transactionHash}`,
        })),
        indexedBlock: page.indexedBlock,
        indexedAt: page.indexedAt,
        sourceDeployment: page.sourceDeployment,
        freshness: page.freshness,
        recordCount: records.length,
        partial: false,
        deterministic: true,
      };
    },
  };
}
