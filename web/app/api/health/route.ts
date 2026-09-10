import { ARC_TESTNET_CHAIN_ID } from '@gol/protocol';
import { NextResponse } from 'next/server';
import { pool } from '@/server/core';
import { EnvironmentError, runtimeConfig } from '@/server/env';

export const runtime = 'nodejs';

const CHECK_TIMEOUT_MS = 5_000;

/**
 * Active readiness check. It verifies the database and the Arc chain ID, reports provider
 * configuration presence, and performs one bounded Graph metadata query. It never makes a paid
 * model call and never returns a secret, wallet ID, or internal error body.
 */
export async function GET() {
  let config;
  try {
    config = runtimeConfig();
  } catch (error) {
    const fields =
      error instanceof EnvironmentError ? error.issues.map((issue) => issue.field) : [];
    return NextResponse.json(
      {
        service: 'gol-web',
        chainId: ARC_TESTNET_CHAIN_ID,
        network: 'arc-testnet',
        ready: false,
        invalidConfiguration: fields,
      },
      { status: 503 },
    );
  }

  const { public: publicConfig, server } = config;
  const [database, chain, graph, langgraphAgent] = await Promise.all([
    checkDatabase(),
    checkChain(publicConfig.rpcUrl),
    checkGraph(server.graphQueryUrl, server.graphApiKey),
    checkLangGraphAgent(),
  ]);

  // Configuration/readiness only. No `kms:Sign` and no `kms:GetPublicKey` call is ever made here:
  // the worker is the only process that talks to KMS.
  const kmsSignerConfigured = Boolean(
    server.awsKmsSignerKeyArn && server.awsKmsSignerRegion && server.awsKmsSignerAddress,
  );
  const privySignerConfigured = Boolean(
    server.privyAuthorizationKeyId &&
    server.privyAuthorizationPrivateKey &&
    process.env.AGENT_MAX_GAS &&
    process.env.AGENT_MAX_FEE_PER_GAS,
  );
  const signerReady =
    server.agentSignerProvider === 'aws_kms' ? kmsSignerConfigured : privySignerConfigured;

  const components = {
    database,
    chain,
    graph,
    langgraphAgent,
    // Presence only. Verifying these providers for real belongs to the redacted preflight command.
    privyConfigured: Boolean(
      server.privyAppId && server.privyAppSecret && server.privyVerificationKey,
    ),
    signer: {
      provider: server.agentSignerProvider,
      ready: signerReady,
      kmsConfigured: kmsSignerConfigured,
      privySignerConfigured,
    },
    privySignerConfigured,
    modelConfigured: Boolean(server.openAiApiKey),
    factoryConfigured: Boolean(publicConfig.factoryAddress),
  };
  const ready =
    components.database.ok &&
    components.chain.ok &&
    components.langgraphAgent.ok &&
    components.privyConfigured &&
    signerReady &&
    components.modelConfigured &&
    components.factoryConfigured &&
    components.graph.status !== 'unconfigured';

  return NextResponse.json(
    {
      service: 'gol-web',
      chainId: ARC_TESTNET_CHAIN_ID,
      network: 'arc-testnet',
      mode: publicConfig.mode,
      sourceCommit: server.sourceCommit,
      ready,
      components,
    },
    { status: ready ? 200 : 503 },
  );
}

async function checkLangGraphAgent(): Promise<{ ok: boolean; error?: string }> {
  const agentUrl = process.env.LANGGRAPH_AGENT_URL?.trim() || 'http://127.0.0.1:8124/agent';
  try {
    const response = await fetch(new URL('/health', agentUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, error: 'LANGGRAPH_AGENT_UNAVAILABLE' };
    const body = (await response.json()) as { status?: string };
    return body.status === 'ok'
      ? { ok: true }
      : { ok: false, error: 'LANGGRAPH_AGENT_UNAVAILABLE' };
  } catch {
    return { ok: false, error: 'LANGGRAPH_AGENT_UNAVAILABLE' };
  }
}

async function checkDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query('SELECT 1');
    return { ok: true };
  } catch {
    return { ok: false, error: 'DATABASE_UNAVAILABLE' };
  }
}

async function checkChain(
  rpcUrl: string,
): Promise<{ ok: boolean; chainId?: number; error?: string }> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, error: 'RPC_UNAVAILABLE' };
    const body = (await response.json()) as { result?: string };
    const chainId = body.result ? Number(BigInt(body.result)) : null;
    if (chainId !== ARC_TESTNET_CHAIN_ID) return { ok: false, error: 'CHAIN_ID_MISMATCH' };
    return { ok: true, chainId };
  } catch {
    return { ok: false, error: 'RPC_UNAVAILABLE' };
  }
}

async function checkGraph(
  url: string | null,
  apiKey: string | null,
): Promise<{ status: 'unconfigured' | 'ok' | 'unavailable'; indexedBlock?: string }> {
  if (!url) return { status: 'unconfigured' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ query: '{ _meta { block { number } hasIndexingErrors } }' }),
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) return { status: 'unavailable' };
    const body = (await response.json()) as {
      data?: { _meta?: { block?: { number?: number }; hasIndexingErrors?: boolean } };
    };
    const block = body.data?._meta?.block?.number;
    if (typeof block !== 'number' || body.data?._meta?.hasIndexingErrors === true) {
      return { status: 'unavailable' };
    }
    return { status: 'ok', indexedBlock: String(block) };
  } catch {
    return { status: 'unavailable' };
  }
}
