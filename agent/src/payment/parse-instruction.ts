import {
  addressSchema,
  parseUsdc,
  paymentIntentSchema,
  type PaymentIntent,
  type RecipientLabel,
} from '@gol/protocol';
import { z } from 'zod';
import type { JsonModel } from '../model/types.js';

const MAX_INSTRUCTION_LENGTH = 2_000;

const parsedSchema = z.object({
  kind: z.enum(['payment', 'clarification']),
  recipient: z.string().nullable(),
  amountUsdc: z.string().nullable(),
  message: z.string().nullable(),
});

export type ParseResult =
  { kind: 'payment'; intent: PaymentIntent } | { kind: 'clarification'; message: string };

export async function parseInstruction(
  text: string,
  recipients: RecipientLabel[],
  model?: JsonModel,
): Promise<ParseResult> {
  const input = text.trim();
  if (input.length === 0 || input.length > MAX_INSTRUCTION_LENGTH) {
    return {
      kind: 'clarification',
      message: 'Enter one payment instruction under 2,000 characters.',
    };
  }

  const deterministic = parseDeterministically(input, recipients);
  if (deterministic !== null || model === undefined) {
    return (
      deterministic ?? {
        kind: 'clarification',
        message: 'Specify one amount and approved recipient.',
      }
    );
  }

  const raw = await model.completeJson<unknown>({
    instructions:
      'Parse one Arc testnet USDC payment using only the supplied approved recipients. Unknown or ambiguous labels require clarification. Never guess, split, reduce, or decide contract policy.',
    input: JSON.stringify({ instruction: input, approvedRecipients: recipients }),
    name: 'gol_payment_intent',
    schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['payment', 'clarification'] },
        recipient: { type: ['string', 'null'] },
        amountUsdc: { type: ['string', 'null'] },
        message: { type: ['string', 'null'] },
      },
      required: ['kind', 'recipient', 'amountUsdc', 'message'],
      additionalProperties: false,
    },
    maxOutputTokens: 250,
  });
  return validateModelResult(raw, recipients);
}

function parseDeterministically(text: string, recipients: RecipientLabel[]): ParseResult | null {
  // "Pay", "Send", or "Transfer" <amount> USDC to <approved label or address>.
  const match = /^(?:pay|send|transfer)\s+([^\s]+)\s+usdc\s+to\s+(.+)$/i.exec(text);
  if (!match) return null;
  const amountUsdc = match[1] ?? '';
  const requestedRecipient = (match[2] ?? '').trim();
  try {
    parseUsdc(amountUsdc);
  } catch {
    return {
      kind: 'clarification',
      message: 'Use a positive USDC amount with at most six decimals.',
    };
  }

  const byAddress = addressSchema.safeParse(requestedRecipient);
  const matches = byAddress.success
    ? recipients.filter((entry) => entry.address.toLowerCase() === byAddress.data.toLowerCase())
    : recipients.filter((entry) => entry.label.toLowerCase() === requestedRecipient.toLowerCase());
  if (matches.length !== 1) {
    return {
      kind: 'clarification',
      message: 'Choose one approved recipient by its exact label or address.',
    };
  }
  return { kind: 'payment', intent: { recipient: matches[0]!.address, amountUsdc } };
}

function validateModelResult(raw: unknown, recipients: RecipientLabel[]): ParseResult {
  const parsed = parsedSchema.safeParse(raw);
  if (!parsed.success) {
    return { kind: 'clarification', message: 'The instruction could not be parsed safely.' };
  }
  if (parsed.data.kind === 'clarification') {
    return {
      kind: 'clarification',
      message: parsed.data.message?.slice(0, 300) || 'Clarify the payment instruction.',
    };
  }
  if (parsed.data.recipient === null || parsed.data.amountUsdc === null) {
    return { kind: 'clarification', message: 'Confirm the approved recipient and amount.' };
  }
  const recipient = addressSchema.safeParse(parsed.data.recipient);
  const intent = paymentIntentSchema.safeParse({
    recipient: recipient.success ? recipient.data : parsed.data.recipient,
    amountUsdc: parsed.data.amountUsdc,
  });
  if (!intent.success)
    return { kind: 'clarification', message: 'Confirm the approved recipient and amount.' };
  try {
    parseUsdc(intent.data.amountUsdc);
  } catch {
    return {
      kind: 'clarification',
      message: 'Use a positive USDC amount with at most six decimals.',
    };
  }
  const approved = recipients.some(
    (entry) => entry.address.toLowerCase() === intent.data.recipient.toLowerCase(),
  );
  return approved
    ? { kind: 'payment', intent: intent.data }
    : { kind: 'clarification', message: 'Choose an approved recipient.' };
}
