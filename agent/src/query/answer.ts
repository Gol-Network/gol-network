import {
  formatUsdc,
  type AccountScope,
  type ActivityPage,
  type GroundedAnswer,
} from '@gol/protocol';
import type { JsonModel } from '../model/types.js';

export interface ActivityProvider {
  get(scope: AccountScope): Promise<ActivityPage>;
}

export async function answerQuestion(
  scope: AccountScope,
  question: string,
  activity: ActivityProvider,
  explorerBaseUrl: string,
  model?: JsonModel,
): Promise<GroundedAnswer> {
  if (question.trim().length === 0 || question.length > 1_000) {
    return base('model_error', 'Ask a question under 1,000 characters.');
  }
  const page = await activity.get(scope);
  if (page.freshness === 'unavailable') {
    return { ...base('unavailable', 'Indexed activity is unavailable.'), partial: false };
  }
  const records = selectRecords(question, page);
  if (records.length === 0) {
    return {
      ...base(
        'empty',
        `No matching records indexed${page.indexedBlock ? ` through block ${page.indexedBlock}` : ''}.`,
      ),
      indexedBlock: page.indexedBlock,
      sourceDeployment: page.sourceDeployment,
    };
  }
  const citations = records.map((record) => ({
    actionId: record.actionId,
    txHash: record.transactionHash,
    logIndex: record.logIndex,
    explorerUrl: `${explorerBaseUrl.replace(/\/$/, '')}/tx/${record.transactionHash}`,
  }));
  const selected = records[0]!;
  const prefix =
    page.freshness === 'stale' ? `Based on records through block ${page.indexedBlock}. ` : '';
  const deterministic =
    selected.outcome === 'REFUSED'
      ? `${prefix}${formatUsdc(BigInt(selected.attempted))} USDC was refused because ${humanRule(selected.rule)}. ${formatUsdc(BigInt(selected.headroom))} USDC remained after ${formatUsdc(BigInt(selected.spentAfter))} USDC had been spent.`
      : `${prefix}${formatUsdc(BigInt(selected.transferred))} USDC was executed, leaving ${formatUsdc(BigInt(selected.headroom))} USDC of mandate headroom.`;

  let text = deterministic;
  let status: GroundedAnswer['status'] =
    page.freshness === 'stale' ? 'stale' : page.partial ? 'partial' : 'answer';
  if (model) {
    try {
      const generated = await model.completeJson<{ text: string; actionIds: string[] }>({
        instructions:
          'Explain only the supplied indexed GOL records. A question cannot cause a payment. Cite only supplied action IDs and preserve every number.',
        input: JSON.stringify({ question, records }),
        name: 'gol_grounded_answer',
        schema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            actionIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'actionIds'],
          additionalProperties: false,
        },
        maxOutputTokens: 400,
      });
      const allowed = new Set(records.map((record) => record.actionId.toLowerCase()));
      if (
        generated.actionIds.length > 0 &&
        generated.actionIds.every((id) => allowed.has(id.toLowerCase())) &&
        validateNumbers(generated.text, records)
      ) {
        text = generated.text;
      } else {
        status = 'model_error';
        text = `Explanation unavailable. ${deterministic}`;
      }
    } catch {
      status = 'model_error';
      text = `Explanation unavailable. ${deterministic}`;
    }
  }
  return {
    status,
    text,
    citations,
    indexedBlock: page.indexedBlock,
    sourceDeployment: page.sourceDeployment,
    recordCount: records.length,
    partial: page.partial,
  };
}

function selectRecords(question: string, page: ActivityPage) {
  const asksRefusal = /refus|denied|why|cap|limit/i.test(question);
  return page.records
    .filter((record) => !asksRefusal || record.outcome === 'REFUSED')
    .slice(0, 200);
}

function validateNumbers(text: string, records: ActivityPage['records']): boolean {
  const evidence = new Set<string>();
  for (const record of records) {
    for (const value of [
      record.attempted,
      record.transferred,
      record.headroom,
      record.spentAfter,
    ]) {
      evidence.add(value);
      evidence.add(formatUsdc(BigInt(value)));
    }
  }
  return [...text.matchAll(/\b\d+(?:\.\d+)?\b/g)].every((match) => evidence.has(match[0]));
}

function humanRule(rule: string): string {
  const rules: Record<string, string> = {
    MANDATE_REVOKED: 'the mandate was revoked',
    MANDATE_EXPIRED: 'the mandate had expired',
    RECIPIENT_NOT_ALLOWED: 'the recipient was not approved',
    PER_PAYMENT_CAP: 'the amount exceeded the per-payment cap',
    CUMULATIVE_CAP: 'the amount exceeded the remaining cumulative cap',
  };
  return rules[rule] ?? 'the account policy refused it';
}

function base(status: GroundedAnswer['status'], text: string): GroundedAnswer {
  return {
    status,
    text,
    citations: [],
    indexedBlock: null,
    sourceDeployment: null,
    recordCount: 0,
    partial: false,
  };
}
