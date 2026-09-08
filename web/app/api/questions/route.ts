import { answerQuestion } from '@gol/agent/query';
import { OpenAIJsonModel } from '@gol/agent/model';
import { addressSchema } from '@gol/protocol';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { activityFor } from '@/server/activity';
import {
  authenticate,
  errorResponse,
  HttpError,
  pool,
  rateLimit,
  readJson,
  requireWriteOrigin,
} from '@/server/core';

export const runtime = 'nodejs';

const schema = z.object({
  account: addressSchema.optional(),
  question: z.string().trim().min(1).max(1_000),
});

export async function POST(request: Request) {
  try {
    const session = await authenticate(request);
    requireWriteOrigin(request, session);
    rateLimit(`question:${session.subject}`, 10);
    const body = schema.parse(await readJson(request));
    const linked = await pool.query(
      'SELECT account_address FROM account_links WHERE user_subject = $1',
      [session.subject],
    );
    if (linked.rowCount !== 1) throw new HttpError(404, 'ACCOUNT_NOT_FOUND');
    const account = addressSchema.parse(String(linked.rows[0].account_address).trim());
    if (body.account && body.account.toLowerCase() !== account.toLowerCase()) {
      throw new HttpError(403, 'ACCOUNT_SCOPE_MISMATCH');
    }
    const page = await activityFor(account, { first: 50 });
    const model = process.env.OPENAI_API_KEY
      ? new OpenAIJsonModel({ apiKey: process.env.OPENAI_API_KEY })
      : undefined;
    const answer = await answerQuestion(
      { chainId: 5_042_002, account },
      body.question,
      { get: async () => page },
      process.env.ARC_EXPLORER_URL ?? 'https://testnet.arcscan.app',
      model,
    );
    return NextResponse.json(answer);
  } catch (error) {
    return errorResponse(error);
  }
}
