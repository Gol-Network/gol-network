import { addressSchema, type Address } from '@gol/protocol';
import { z } from 'zod';

const AAVE_SUPPORTED_CHAINS = new Set([1, 43_114]);

const transactionSchema = z
  .object({
    __typename: z.literal('TransactionRequest').optional(),
    to: addressSchema,
    from: addressSchema,
    data: z
      .string()
      .regex(/^0x[0-9a-fA-F]*$/)
      .max(131_074),
    value: z.string().regex(/^(0x[0-9a-fA-F]+|[0-9]+)$/),
    chainId: z.number().int().positive(),
    operations: z.array(z.string().max(120)).max(20).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (!AAVE_SUPPORTED_CHAINS.has(value.chainId)) {
      context.addIssue({
        code: 'custom',
        path: ['chainId'],
        message: 'The prepared transaction uses an unsupported Aave chain.',
      });
    }
  });

export type PreparedAaveTransaction = {
  to: Address;
  from: Address;
  data: `0x${string}`;
  value: string;
  chainId: number;
  operations: string[];
};

export type PreparedAaveReview = {
  transaction: PreparedAaveTransaction;
  step: 'approval' | 'action';
  warnings: string[];
  nextActions: string[];
};

function parseMcpData(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== 'object') return null;
  const envelope = result as {
    data?: unknown;
    content?: Array<{ type?: string; text?: string }>;
  };
  if (envelope.data && typeof envelope.data === 'object') {
    return result as Record<string, unknown>;
  }
  const text = envelope.content?.find((entry) => entry.type === 'text')?.text;
  if (!text || text.length > 4_000_000) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseTransaction(candidate: unknown): PreparedAaveTransaction | null {
  const parsed = transactionSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return {
    to: parsed.data.to,
    from: parsed.data.from,
    data: parsed.data.data as `0x${string}`,
    value: parsed.data.value,
    chainId: parsed.data.chainId,
    operations: parsed.data.operations ?? [],
  };
}

function findTransaction(value: unknown, depth = 0): PreparedAaveTransaction | null {
  if (depth > 7 || !value || typeof value !== 'object') return null;
  const direct = parseTransaction(value);
  if (direct) return direct;
  const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  for (const child of children) {
    const transaction = findTransaction(child, depth + 1);
    if (transaction) return transaction;
  }
  return null;
}

export function extractPreparedAaveReview(result: unknown): PreparedAaveReview | null {
  const root = parseMcpData(result);
  const data = root?.data;
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const approval =
    record.__typename === 'Erc20ApprovalRequired' && Array.isArray(record.approvals)
      ? parseTransaction(
          (record.approvals[0] as { byTransaction?: unknown } | undefined)?.byTransaction,
        )
      : null;
  const transaction = approval ?? findTransaction(data);
  if (!transaction) return null;
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.flatMap((warning) => {
        if (!warning || typeof warning !== 'object') return [];
        const message = (warning as Record<string, unknown>).message;
        return typeof message === 'string' ? [message] : [];
      })
    : [];
  const nextActions = Array.isArray(root.next_actions)
    ? root.next_actions.filter((item): item is string => typeof item === 'string').slice(0, 3)
    : [];
  return { transaction, step: approval ? 'approval' : 'action', warnings, nextActions };
}
