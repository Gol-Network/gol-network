import { getAddress, isAddress } from 'viem';
import { z } from 'zod';

export const hex32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const decimalUnitsSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
export const addressSchema = z
  .string()
  .refine(isAddress, 'Invalid EVM address')
  .transform((address) => getAddress(address));
export const mandateIdSchema = decimalUnitsSchema.refine((value) => BigInt(value) > 0n);

export const requestStateSchema = z.enum([
  'queued',
  'needs_clarification',
  'signing',
  'submitted',
  'pending',
  'executed',
  'refused',
  'signer_blocked',
  'technical_failure',
  'unknown',
]);

export const paymentIntentSchema = z.object({
  recipient: addressSchema,
  amountUsdc: z.string(),
});

export const paymentResultSchema = z.object({
  requestId: hex32Schema,
  state: requestStateSchema,
  txHash: hex32Schema.nullable(),
  rule: z.string().nullable(),
  attemptedUnits: decimalUnitsSchema.nullable(),
  headroomUnits: decimalUnitsSchema.nullable(),
  indexed: z.boolean(),
});

export const recipientLabelSchema = z.object({
  label: z.string().trim().min(1).max(100),
  address: addressSchema,
});

export type Hex32 = `0x${string}`;
export type Address = `0x${string}`;
export type RequestState = z.infer<typeof requestStateSchema>;
export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
export type PaymentResult = z.infer<typeof paymentResultSchema>;
export type RecipientLabel = z.infer<typeof recipientLabelSchema>;

export interface VerifiedAgentContext {
  userSubject: string;
  chainId: 5042002;
  account: Address;
  agentAddress: Address;
  agentWalletId: string;
}

export interface AccountScope {
  chainId: 5042002;
  account: Address;
  mandateId?: string;
  agent?: Address;
}

export interface ActivityFilter {
  outcome?: 'EXECUTED' | 'REFUSED';
  rule?: string;
  mandateId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  first: number;
  cursor?: string;
}

export interface ActivityRecord {
  actionId: Hex32;
  requestId: Hex32;
  mandateId: string;
  agent: Address;
  recipient: Address;
  outcome: 'EXECUTED' | 'REFUSED';
  rule: string;
  reason: string;
  attempted: string;
  transferred: string;
  headroom: string;
  spentAfter: string;
  sequence: string;
  transactionHash: Hex32;
  blockNumber: string;
  blockHash: Hex32;
  timestamp: string;
  logIndex: string;
}

export interface ActivityPage {
  records: ActivityRecord[];
  cursor: string | null;
  indexedBlock: string | null;
  indexedBlockHash: Hex32 | null;
  indexedAt: string | null;
  chainHeadBlock: string | null;
  hasIndexingErrors: boolean | null;
  freshness: 'current' | 'catching_up' | 'stale' | 'unknown' | 'unavailable';
  sourceDeployment: string | null;
  partial: boolean;
}

export interface Citation {
  actionId: Hex32;
  txHash: Hex32;
  logIndex: string;
  explorerUrl: string;
}

export interface GroundedAnswer {
  status: 'answer' | 'empty' | 'partial' | 'stale' | 'unavailable' | 'model_error';
  text: string;
  citations: Citation[];
  indexedBlock: string | null;
  sourceDeployment: string | null;
  recordCount: number;
  partial: boolean;
}
