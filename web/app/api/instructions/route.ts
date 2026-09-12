import { PgJournal } from '@gol/agent/db';
import { addressSchema, hex32Schema, mandateIdSchema } from '@gol/protocol';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticate,
  errorResponse,
  pool,
  rateLimit,
  readJson,
  requireWriteOrigin,
} from '@/server/core';

export const runtime = 'nodejs';

const schema = z.object({
  account: addressSchema.optional(),
  mandateId: mandateIdSchema,
  requestId: hex32Schema,
  text: z.string().trim().min(1).max(2_000),
});

export async function POST(request: Request) {
  try {
    const session = await authenticate(request);
    requireWriteOrigin(request, session);
    rateLimit(`pay:${session.subject}`, 5);
    const body = schema.parse(await readJson(request));
    const link = await pool.query(
      `SELECT a.account_address,
              EXISTS (
                SELECT 1 FROM recipients r
                WHERE r.account_address = a.account_address AND r.confirmed_at IS NOT NULL
              ) AS recipient_confirmed
       FROM account_links a
       WHERE a.user_subject = $1`,
      [session.subject],
    );
    if (link.rowCount !== 1)
      return NextResponse.json({ error: 'ACCOUNT_NOT_FOUND' }, { status: 404 });
    const account = addressSchema.parse(String(link.rows[0].account_address).trim());
    if (body.account && body.account.toLowerCase() !== account.toLowerCase()) {
      return NextResponse.json({ error: 'ACCOUNT_SCOPE_MISMATCH' }, { status: 403 });
    }
    if (link.rows[0].recipient_confirmed !== true) {
      return NextResponse.json({ error: 'RECIPIENT_CONFIRMATION_REQUIRED' }, { status: 409 });
    }
    const journal = new PgJournal(pool);
    const result = await journal.enqueue({
      userSubject: session.subject,
      account,
      mandateId: body.mandateId,
      requestId: body.requestId as `0x${string}`,
      text: body.text,
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
