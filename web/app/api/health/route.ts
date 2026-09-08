import { NextResponse } from 'next/server';
import { pool } from '@/server/core';

export const runtime = 'nodejs';

export async function GET() {
  const components = {
    database: false,
    rpcConfigured: Boolean(process.env.ARC_RPC_URL),
    graphConfigured: Boolean(process.env.GRAPH_QUERY_URL),
    privyConfigured: Boolean(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
      process.env.PRIVY_APP_ID &&
      process.env.PRIVY_APP_SECRET &&
      process.env.PRIVY_VERIFICATION_KEY &&
      process.env.PRIVY_AUTHORIZATION_KEY_ID &&
      process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY,
    ),
    modelConfigured: Boolean(process.env.OPENAI_API_KEY),
  };
  try {
    await pool.query('SELECT 1');
    components.database = true;
  } catch {}
  const ready = Object.values(components).every(Boolean);
  return NextResponse.json(
    { service: 'gol-web', chainId: 5_042_002, network: 'arc-testnet', ready, components },
    { status: ready ? 200 : 503 },
  );
}
