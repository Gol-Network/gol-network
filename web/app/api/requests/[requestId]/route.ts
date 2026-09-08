import { PgJournal } from '@gol/agent/db';
import { hex32Schema } from '@gol/protocol';
import { NextResponse } from 'next/server';
import { authenticate, errorResponse, pool } from '@/server/core';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    const session = await authenticate(request);
    const { requestId } = await context.params;
    const validated = hex32Schema.parse(requestId) as `0x${string}`;
    const result = await new PgJournal(pool).getForUser(session.subject, validated);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
