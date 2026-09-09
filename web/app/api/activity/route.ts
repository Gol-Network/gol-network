import { ACTIVITY_PAGE_MAX, REFUSAL_RULES, addressSchema } from '@gol/protocol';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate, errorResponse, HttpError, pool } from '@/server/core';
import { activityFor } from '@/server/activity';
import { runtimeConfig } from '@/server/env';

export const runtime = 'nodejs';

const querySchema = z.object({
  account: addressSchema,
  outcome: z.enum(['EXECUTED', 'REFUSED']).optional(),
  rule: z.enum(REFUSAL_RULES).optional(),
  mandateId: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .optional(),
  fromTimestamp: z
    .string()
    .regex(/^[0-9]+$/)
    .optional(),
  toTimestamp: z
    .string()
    .regex(/^[0-9]+$/)
    .optional(),
  first: z.coerce.number().int().min(1).max(ACTIVITY_PAGE_MAX).default(ACTIVITY_PAGE_MAX),
  cursor: z
    .string()
    .regex(/^[0-9]+$/)
    .optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.parse(Object.fromEntries(url.searchParams));
    const demo = runtimeConfig().server.demoAccount?.toLowerCase();
    if (parsed.account.toLowerCase() !== demo) {
      const session = await authenticate(request);
      const linked = await pool.query(
        'SELECT 1 FROM account_links WHERE user_subject = $1 AND lower(account_address) = lower($2)',
        [session.subject, parsed.account],
      );
      if (linked.rowCount !== 1) throw new HttpError(404, 'ACCOUNT_NOT_FOUND');
    }
    return NextResponse.json(
      await activityFor(parsed.account, {
        first: parsed.first,
        ...(parsed.outcome ? { outcome: parsed.outcome } : {}),
        ...(parsed.rule ? { rule: parsed.rule } : {}),
        ...(parsed.mandateId ? { mandateId: parsed.mandateId } : {}),
        ...(parsed.fromTimestamp ? { fromTimestamp: parsed.fromTimestamp } : {}),
        ...(parsed.toTimestamp ? { toTimestamp: parsed.toTimestamp } : {}),
        ...(parsed.cursor ? { cursor: parsed.cursor } : {}),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
