import { PgJournal } from '@gol/agent/db';
import { hex32Schema } from '@gol/protocol';
import { NextResponse } from 'next/server';
import { authenticate, errorResponse, pool } from '@/server/core';
import { explorerTransactionUrl } from '@/server/chain';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    const session = await authenticate(request);
    const { requestId } = await context.params;
    const validated = hex32Schema.parse(requestId) as `0x${string}`;
    const result = await new PgJournal(pool).getForUser(session.subject, validated);
    return NextResponse.json({
      requestId: result.requestId,
      account: result.account,
      mandateId: result.mandateId,
      state: result.state,
      recipient: result.parsedRecipient,
      amountUnits: result.parsedAmount,
      txHash: result.txHash,
      rule: result.rule,
      attemptedUnits: result.attemptedUnits,
      headroomUnits: result.headroomUnits,
      errorCode: result.errorCode,
      // A transaction link is available as soon as a hash exists, well before an outcome is known.
      explorerUrl: result.txHash ? explorerTransactionUrl(result.txHash) : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
