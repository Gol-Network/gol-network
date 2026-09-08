import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: process.env.DEMO_ACCOUNT ? 'configured' : 'not_deployed',
    chainId: 5_042_002,
    network: 'arc-testnet',
    account: process.env.DEMO_ACCOUNT ?? null,
    factory: process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? null,
    activityAvailable: Boolean(process.env.DEMO_ACCOUNT && process.env.GRAPH_QUERY_URL),
    interactive: false,
  });
}
