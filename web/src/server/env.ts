import 'server-only';

import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  ARC_TESTNET_RPC_URL,
  DEFAULT_AGENT_GAS_TOPUP_UNITS,
  DEMO_MANDATE_CAP_UNITS,
  parseUsdc,
} from '@gol/protocol';
import { isAddress, getAddress } from 'viem';
import type { PublicConfig } from '@/config';

export interface EnvironmentIssue {
  /** Field name only. Values are never echoed, because several of them are secrets. */
  field: string;
  problem:
    | 'required'
    | 'invalid_address'
    | 'requires_https'
    | 'invalid_url'
    | 'invalid_chain_id'
    | 'invalid_amount'
    | 'invalid_arn'
    | 'invalid_provider'
    | 'unpaired';
}

export interface RuntimeConfig {
  public: PublicConfig;
  server: {
    databaseUrl: string | null;
    appOrigin: string | null;
    privyAppId: string | null;
    privyAppSecret: string | null;
    privyVerificationKey: string | null;
    privyAuthorizationKeyId: string | null;
    privyAuthorizationPrivateKey: string | null;
    graphQueryUrl: string | null;
    graphApiKey: string | null;
    openAiApiKey: string | null;
    /** Server-only Botanary API used for owner money build, relay, quote, and receive flows. */
    botanaryApiUrl: string | null;
    /** Active agent signer. Privy stays authoritative for owner authentication regardless. */
    agentSignerProvider: 'privy' | 'aws_kms';
    /** Operational configuration. Never exposed to a browser bundle or a public API response. */
    awsKmsSignerKeyArn: string | null;
    awsKmsSignerRegion: string | null;
    awsKmsSignerAddress: string | null;
    demoAccount: string | null;
    developerToken: string | null;
    developerSubject: string;
    sourceCommit: string | null;
  };
}

export class EnvironmentError extends Error {
  readonly code = 'INVALID_ENVIRONMENT';

  constructor(readonly issues: EnvironmentIssue[]) {
    super(
      `Invalid runtime configuration: ${issues
        .map((issue) => `${issue.field} (${issue.problem})`)
        .join(', ')}`,
    );
  }
}

type Source = Record<string, string | undefined>;

export type EnvironmentResult =
  { ok: true; config: RuntimeConfig } | { ok: false; issues: EnvironmentIssue[] };

/**
 * Parses and validates every runtime field the application reads. Production requires the fields
 * an integration needs; development tolerates their absence and reports fixture mode instead.
 */
export function parseEnvironment(
  source: Source,
  options: { production: boolean },
): EnvironmentResult {
  const issues: EnvironmentIssue[] = [];
  const value = (name: string): string | null => {
    const raw = source[name]?.trim();
    return raw ? raw : null;
  };
  const fixtureModeRequested = value('GOL_FIXTURE_MODE') === 'true';

  const demand = (name: string, raw: string | null): string | null => {
    if (options.production && !fixtureModeRequested && raw === null) {
      issues.push({ field: name, problem: 'required' });
    }
    return raw;
  };

  const address = (name: string, raw: string | null): `0x${string}` | null => {
    if (raw === null) return null;
    if (!isAddress(raw)) {
      issues.push({ field: name, problem: 'invalid_address' });
      return null;
    }
    return getAddress(raw);
  };

  const url = (name: string, raw: string | null, fallback: string | null): string | null => {
    const candidate = raw ?? fallback;
    if (candidate === null) return null;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      issues.push({ field: name, problem: 'invalid_url' });
      return null;
    }
    const allowsHttp = !options.production || fixtureModeRequested;
    if (parsed.protocol !== 'https:' && !(allowsHttp && parsed.protocol === 'http:')) {
      issues.push({ field: name, problem: 'requires_https' });
      return null;
    }
    return candidate;
  };

  const usdcUnits = (name: string, raw: string | null, fallback: bigint): string => {
    if (raw === null) return fallback.toString();
    try {
      return parseUsdc(raw).toString();
    } catch {
      issues.push({ field: name, problem: 'invalid_amount' });
      return fallback.toString();
    }
  };

  const wei = (name: string, raw: string | null, fallback: bigint): string => {
    if (raw === null) return fallback.toString();
    if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
      issues.push({ field: name, problem: 'invalid_amount' });
      return fallback.toString();
    }
    return raw;
  };

  const chainIdRaw = value('ARC_CHAIN_ID');
  if (chainIdRaw !== null && Number(chainIdRaw) !== ARC_TESTNET_CHAIN_ID) {
    issues.push({ field: 'ARC_CHAIN_ID', problem: 'invalid_chain_id' });
  }

  const privyAppId = demand('PRIVY_APP_ID', value('PRIVY_APP_ID'));
  const privyAppSecret = demand('PRIVY_APP_SECRET', value('PRIVY_APP_SECRET'));
  const privyVerificationKey = demand('PRIVY_VERIFICATION_KEY', value('PRIVY_VERIFICATION_KEY'));
  const authorizationKeyId = demand(
    'PRIVY_AUTHORIZATION_KEY_ID',
    value('PRIVY_AUTHORIZATION_KEY_ID'),
  );
  const authorizationPrivateKey = demand(
    'PRIVY_AUTHORIZATION_PRIVATE_KEY',
    value('PRIVY_AUTHORIZATION_PRIVATE_KEY'),
  );
  // The key ID identifies the key quorum that owns the private key. One without the other cannot
  // authorize a signer, so an unpaired configuration is rejected in every environment.
  if (Boolean(authorizationKeyId) !== Boolean(authorizationPrivateKey)) {
    issues.push({
      field: authorizationKeyId ? 'PRIVY_AUTHORIZATION_PRIVATE_KEY' : 'PRIVY_AUTHORIZATION_KEY_ID',
      problem: 'unpaired',
    });
  }

  // Agent signer selection. The KMS fields are operational configuration, never browser-exposed.
  const signerProviderRaw = value('AGENT_SIGNER_PROVIDER');
  let agentSignerProvider: 'privy' | 'aws_kms' = 'privy';
  if (signerProviderRaw !== null) {
    if (signerProviderRaw === 'privy' || signerProviderRaw === 'aws_kms') {
      agentSignerProvider = signerProviderRaw;
    } else {
      issues.push({ field: 'AGENT_SIGNER_PROVIDER', problem: 'invalid_provider' });
    }
  }
  const isKms = agentSignerProvider === 'aws_kms';
  const kmsDemand = (name: string): string | null => {
    const raw = value(name);
    if (isKms && raw === null) issues.push({ field: name, problem: 'required' });
    return raw;
  };
  const awsKmsSignerKeyArnRaw = kmsDemand('AWS_KMS_SIGNER_KEY_ARN');
  if (awsKmsSignerKeyArnRaw !== null && !awsKmsSignerKeyArnRaw.startsWith('arn:aws:kms:')) {
    issues.push({ field: 'AWS_KMS_SIGNER_KEY_ARN', problem: 'invalid_arn' });
  }
  const awsKmsSignerRegion = kmsDemand('AWS_KMS_SIGNER_REGION');
  const awsKmsSignerAddress = address(
    'AWS_KMS_SIGNER_ADDRESS',
    kmsDemand('AWS_KMS_SIGNER_ADDRESS'),
  );
  // The operator funds the shared agent gas reserve by default under aws_kms. Owner-funded gas can
  // be forced back on with AGENT_GAS_MANAGED=false.
  const agentGasManagedRaw = value('AGENT_GAS_MANAGED');
  const agentGasManaged =
    agentGasManagedRaw === null
      ? isKms
      : agentGasManagedRaw !== 'false' && agentGasManagedRaw !== '0';

  const factoryAddress = address(
    'FACTORY_ADDRESS',
    demand('FACTORY_ADDRESS', value('FACTORY_ADDRESS')),
  );
  const demoAccount = address('DEMO_ACCOUNT', value('DEMO_ACCOUNT'));
  const rpcUrl = url('ARC_RPC_URL', value('ARC_RPC_URL'), ARC_TESTNET_RPC_URL);
  const explorerUrl = url('ARC_EXPLORER_URL', value('ARC_EXPLORER_URL'), ARC_TESTNET_EXPLORER_URL);
  const faucetUrl = url('ARC_FAUCET_URL', value('ARC_FAUCET_URL'), 'https://faucet.circle.com/');
  const graphQueryUrl = url(
    'GRAPH_QUERY_URL',
    demand('GRAPH_QUERY_URL', value('GRAPH_QUERY_URL')),
    null,
  );
  const appOrigin = url('APP_ORIGIN', demand('APP_ORIGIN', value('APP_ORIGIN')), null);
  const botanaryApiUrl = url('BOTANARY_API_URL', value('BOTANARY_API_URL'), null);
  demand('DATABASE_URL', value('DATABASE_URL'));

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    config: {
      public: {
        mode: !fixtureModeRequested && privyAppId && factoryAddress ? 'live' : 'fixture',
        privyAppId,
        factoryAddress,
        chainId: ARC_TESTNET_CHAIN_ID,
        chainName: 'Arc testnet',
        rpcUrl: rpcUrl ?? ARC_TESTNET_RPC_URL,
        explorerUrl: explorerUrl ?? ARC_TESTNET_EXPLORER_URL,
        faucetUrl,
        agentSignerProvider,
        agentSignerAddress: isKms ? awsKmsSignerAddress : null,
        agentGasManaged,
        recipientLabel: value('GOL_RECIPIENT_LABEL') ?? 'Design contractor',
        accountTargetUnits: usdcUnits(
          'GOL_ACCOUNT_TARGET_USDC',
          value('GOL_ACCOUNT_TARGET_USDC'),
          DEMO_MANDATE_CAP_UNITS,
        ),
        agentGasTopUpUnits: usdcUnits(
          'GOL_AGENT_GAS_TOPUP_USDC',
          value('GOL_AGENT_GAS_TOPUP_USDC'),
          DEFAULT_AGENT_GAS_TOPUP_UNITS,
        ),
        minOwnerGasWei: wei('GOL_MIN_OWNER_GAS_WEI', value('GOL_MIN_OWNER_GAS_WEI'), 10n ** 15n),
        minAgentGasWei: wei('GOL_MIN_AGENT_GAS_WEI', value('GOL_MIN_AGENT_GAS_WEI'), 10n ** 15n),
      },
      server: {
        databaseUrl: value('DATABASE_URL'),
        appOrigin,
        privyAppId,
        privyAppSecret,
        privyVerificationKey,
        privyAuthorizationKeyId: authorizationKeyId,
        privyAuthorizationPrivateKey: authorizationPrivateKey,
        graphQueryUrl,
        graphApiKey: value('GRAPH_API_KEY'),
        openAiApiKey: value('OPENAI_API_KEY'),
        botanaryApiUrl,
        agentSignerProvider,
        awsKmsSignerKeyArn: awsKmsSignerKeyArnRaw,
        awsKmsSignerRegion,
        awsKmsSignerAddress,
        demoAccount,
        developerToken: value('GOL_DEV_TOKEN'),
        developerSubject: value('GOL_DEV_SUBJECT') ?? 'developer',
        sourceCommit: value('GOL_SOURCE_COMMIT'),
      },
    },
  };
}

let cached: RuntimeConfig | null = null;

/** Reads validated runtime configuration on the server. Never call this from client code. */
export function runtimeConfig(): RuntimeConfig {
  const production = process.env.NODE_ENV === 'production';
  // Only a production process has an immutable environment worth caching.
  if (production && cached) return cached;
  const result = parseEnvironment(process.env, { production });
  if (!result.ok) throw new EnvironmentError(result.issues);
  if (production) cached = result.config;
  return result.config;
}

export function publicConfig(): PublicConfig {
  return runtimeConfig().public;
}

/**
 * Public configuration for server components, which must render a configuration notice rather
 * than a stack trace when required production fields are missing.
 */
export function publicConfigResult():
  { ok: true; config: PublicConfig } | { ok: false; fields: string[] } {
  try {
    return { ok: true, config: publicConfig() };
  } catch (error) {
    if (error instanceof EnvironmentError) {
      return { ok: false, fields: error.issues.map((issue) => issue.field) };
    }
    throw error;
  }
}

/** Test-only reset so a suite can vary the environment without leaking a cached parse. */
export function resetRuntimeConfigCache(): void {
  cached = null;
}
