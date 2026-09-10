/**
 * Redacted provider preflight.
 *
 * Prints booleans, public identifiers, and error codes only. No credential value, wallet ID, or
 * provider error body is ever written to the output, and no paid model call is made.
 *
 * Run: pnpm preflight
 */

const ARC_CHAIN_ID = 5_042_002;
const OWNER_SELECTOR = '0x8da5cb5b';
const DEFAULT_MODEL = 'gpt-5.5-2026-04-23';
const TIMEOUT_MS = 10_000;

type Check = {
  name: string;
  ok: boolean;
  detail?: string | number | boolean | null;
  error?: string;
};

const env = process.env;
const SIGNER_PROVIDER = env.AGENT_SIGNER_PROVIDER === 'aws_kms' ? 'aws_kms' : 'privy';

void main();

async function main() {
  const checks: Check[] = [];
  const configured = [
    'DATABASE_URL',
    'APP_ORIGIN',
    'ARC_RPC_URL',
    'GRAPH_QUERY_URL',
    'PRIVY_APP_ID',
    'PRIVY_APP_SECRET',
    'PRIVY_VERIFICATION_KEY',
    'OPENAI_API_KEY',
    'FACTORY_ADDRESS',
    'AGENT_MAX_GAS',
    'AGENT_MAX_FEE_PER_GAS',
    ...(SIGNER_PROVIDER === 'aws_kms'
      ? ['AWS_KMS_SIGNER_KEY_ARN', 'AWS_KMS_SIGNER_REGION', 'AWS_KMS_SIGNER_ADDRESS']
      : ['PRIVY_AUTHORIZATION_KEY_ID', 'PRIVY_AUTHORIZATION_PRIVATE_KEY']),
  ];
  const missing = configured.filter((name) => !env[name]);
  checks.push({
    name: 'configuration_present',
    ok: missing.length === 0,
    detail: missing.length === 0 ? 'all' : missing.join(','),
  });
  checks.push({ name: 'agent_signer_provider', ok: true, detail: SIGNER_PROVIDER });

  if (SIGNER_PROVIDER === 'aws_kms') {
    checks.push(kmsSignerConfig());
  } else {
    checks.push({
      name: 'privy_authorization_pair',
      ok:
        Boolean(env.PRIVY_AUTHORIZATION_KEY_ID) === Boolean(env.PRIVY_AUTHORIZATION_PRIVATE_KEY) &&
        /^[1-9][0-9]*$/.test(env.AGENT_MAX_GAS ?? '') &&
        /^[1-9][0-9]*$/.test(env.AGENT_MAX_FEE_PER_GAS ?? ''),
      detail: env.PRIVY_AUTHORIZATION_KEY_ID ?? null,
    });
  }

  checks.push(await arcChainId());
  checks.push(await deployedBytecode());
  checks.push(await accountOwnership());
  checks.push(await privyApplication());
  if (SIGNER_PROVIDER === 'privy') checks.push(await privySignerQuorum());
  checks.push(await openAiModelAccess());
  checks.push(await graphMeta());

  const ready = checks.every((check) => check.ok);
  process.stdout.write(`${JSON.stringify({ ready, checks }, null, 2)}\n`);
  if (!ready) process.exitCode = 1;
}

async function arcChainId(): Promise<Check> {
  const url = env.ARC_RPC_URL;
  if (!url) return { name: 'arc_chain_id', ok: false, error: 'NOT_CONFIGURED' };
  try {
    const result = await rpc(url, 'eth_chainId', []);
    const chainId = Number(BigInt(String(result)));
    return { name: 'arc_chain_id', ok: chainId === ARC_CHAIN_ID, detail: chainId };
  } catch (error) {
    return { name: 'arc_chain_id', ok: false, error: code(error) };
  }
}

async function deployedBytecode(): Promise<Check> {
  const url = env.ARC_RPC_URL;
  const factory = env.FACTORY_ADDRESS;
  if (!url || !factory) return { name: 'factory_bytecode', ok: false, error: 'NOT_CONFIGURED' };
  try {
    const result = String(await rpc(url, 'eth_getCode', [factory, 'latest']));
    return { name: 'factory_bytecode', ok: result.length > 2, detail: factory };
  } catch (error) {
    return { name: 'factory_bytecode', ok: false, error: code(error) };
  }
}

async function accountOwnership(): Promise<Check> {
  const url = env.ARC_RPC_URL;
  const account = env.DEMO_ACCOUNT;
  if (!url || !account) return { name: 'account_ownership', ok: false, error: 'NOT_CONFIGURED' };
  try {
    const result = String(
      await rpc(url, 'eth_call', [{ to: account, data: OWNER_SELECTOR }, 'latest']),
    );
    if (result.length !== 66) return { name: 'account_ownership', ok: false, error: 'NO_OWNER' };
    const owner = `0x${result.slice(26)}`;
    const expected = env.GOL_DEMO_OWNER?.toLowerCase();
    return {
      name: 'account_ownership',
      ok: expected ? owner.toLowerCase() === expected : owner !== `0x${'0'.repeat(40)}`,
      detail: owner,
    };
  } catch (error) {
    return { name: 'account_ownership', ok: false, error: code(error) };
  }
}

/**
 * KMS signer configuration only. `kms:GetPublicKey` belongs to the worker identity, so the preflight
 * checks ARN shape, region presence, address checksum, and the numeric ceilings without any AWS call.
 */
function kmsSignerConfig(): Check {
  const arn = env.AWS_KMS_SIGNER_KEY_ARN ?? '';
  const region = env.AWS_KMS_SIGNER_REGION ?? '';
  const address = env.AWS_KMS_SIGNER_ADDRESS ?? '';
  const arnOk = /^arn:aws:kms:[a-z0-9-]+:\d{12}:key\/[0-9a-fA-F-]{36}$/.test(arn);
  const regionOk = /^[a-z]{2}-[a-z]+-\d$/.test(region);
  const addressOk = /^0x[0-9a-fA-F]{40}$/.test(address);
  const gasOk = /^[1-9][0-9]*$/.test(env.AGENT_MAX_GAS ?? '');
  const feeOk = /^[1-9][0-9]*$/.test(env.AGENT_MAX_FEE_PER_GAS ?? '');
  const arnRegion = arn.split(':')[3] ?? '';
  return {
    name: 'kms_signer_config',
    ok: arnOk && regionOk && addressOk && gasOk && feeOk && arnRegion === region,
    detail: addressOk ? address : null,
    ...(arnOk && regionOk && addressOk && gasOk && feeOk && arnRegion === region
      ? {}
      : { error: 'INVALID_KMS_CONFIG' }),
  };
}

async function privyApplication(): Promise<Check> {
  const appId = env.PRIVY_APP_ID;
  const appSecret = env.PRIVY_APP_SECRET;
  if (!appId || !appSecret)
    return { name: 'privy_application', ok: false, error: 'NOT_CONFIGURED' };
  const response = await privyRequest(`https://api.privy.io/v1/apps/${appId}`);
  return {
    name: 'privy_application',
    ok: response.ok,
    detail: appId,
    ...(response.ok ? {} : { error: `HTTP_${response.status}` }),
  };
}

async function privySignerQuorum(): Promise<Check> {
  const quorumId = env.PRIVY_AUTHORIZATION_KEY_ID;
  if (!quorumId) return { name: 'privy_signer_quorum', ok: false, error: 'NOT_CONFIGURED' };
  const response = await privyRequest(`https://api.privy.io/v1/key_quorums/${quorumId}`);
  return {
    name: 'privy_signer_quorum',
    ok: response.ok,
    detail: quorumId,
    ...(response.ok ? {} : { error: `HTTP_${response.status}` }),
  };
}

/** Model metadata only. A paid completion is never issued by the preflight. */
async function openAiModelAccess(): Promise<Check> {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL ?? DEFAULT_MODEL;
  if (!apiKey) return { name: 'openai_model_access', ok: false, error: 'NOT_CONFIGURED' };
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${model}`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return {
      name: 'openai_model_access',
      ok: response.ok,
      detail: model,
      ...(response.ok ? {} : { error: `HTTP_${response.status}` }),
    };
  } catch (error) {
    return { name: 'openai_model_access', ok: false, error: code(error) };
  }
}

async function graphMeta(): Promise<Check> {
  const url = env.GRAPH_QUERY_URL;
  if (!url) return { name: 'graph_meta', ok: false, error: 'NOT_CONFIGURED' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.GRAPH_API_KEY ? { authorization: `Bearer ${env.GRAPH_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        query: '{ _meta { block { number } hasIndexingErrors deployment } }',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { name: 'graph_meta', ok: false, error: `HTTP_${response.status}` };
    const body = (await response.json()) as {
      data?: {
        _meta?: { block?: { number?: number }; hasIndexingErrors?: boolean; deployment?: string };
      };
    };
    const meta = body.data?._meta;
    return {
      name: 'graph_meta',
      ok: typeof meta?.block?.number === 'number' && meta.hasIndexingErrors !== true,
      detail: meta?.deployment ?? null,
    };
  } catch (error) {
    return { name: 'graph_meta', ok: false, error: code(error) };
  }
}

async function privyRequest(url: string): Promise<Response> {
  const appId = env.PRIVY_APP_ID ?? '';
  const appSecret = env.PRIVY_APP_SECRET ?? '';
  try {
    return await fetch(url, {
      headers: {
        authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
        'privy-app-id': appId,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return new Response(null, { status: 599 });
  }
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const body = (await response.json()) as { result?: unknown; error?: { code?: number } };
  if (body.error) throw new Error(`RPC_${body.error.code ?? 'ERROR'}`);
  return body.result;
}

/** Reduces any failure to a short code so no provider error body is printed. */
function code(error: unknown): string {
  const text = error instanceof Error ? error.message : 'UNKNOWN';
  return /^[A-Z0-9_]+$/.test(text) ? text : 'REQUEST_FAILED';
}
