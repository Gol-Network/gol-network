import { ARC_TESTNET_CHAIN_ID } from '@gol/protocol';
import { NextResponse } from 'next/server';
import { EnvironmentError, runtimeConfig } from '@/server/env';

export const runtime = 'nodejs';

export function GET() {
  let config;
  try {
    config = runtimeConfig();
  } catch (error) {
    const fields =
      error instanceof EnvironmentError ? error.issues.map((issue) => issue.field) : [];
    return NextResponse.json(
      {
        status: 'not_deployed',
        chainId: ARC_TESTNET_CHAIN_ID,
        network: 'arc-testnet',
        invalidConfiguration: fields,
        interactive: false,
      },
      { status: 503 },
    );
  }
  const { public: publicConfig, server } = config;
  return NextResponse.json({
    status: server.demoAccount ? 'configured' : 'not_deployed',
    chainId: ARC_TESTNET_CHAIN_ID,
    network: 'arc-testnet',
    mode: publicConfig.mode,
    account: server.demoAccount,
    factory: publicConfig.factoryAddress,
    activityAvailable: Boolean(server.demoAccount && server.graphQueryUrl),
    interactive: false,
  });
}
