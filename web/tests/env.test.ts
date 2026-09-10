import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '@/server/env';

const complete: Record<string, string> = {
  DATABASE_URL: 'postgresql://gol_runtime:secret@postgres:5432/gol',
  APP_ORIGIN: 'https://gol.example.com',
  PRIVY_APP_ID: 'app-id',
  PRIVY_APP_SECRET: 'app-secret',
  PRIVY_VERIFICATION_KEY: 'verification-key',
  PRIVY_AUTHORIZATION_KEY_ID: 'quorum-id',
  PRIVY_AUTHORIZATION_PRIVATE_KEY: 'authorization-private-key',
  GRAPH_QUERY_URL: 'https://gateway.thegraph.com/api/subgraphs/id/Qm',
  FACTORY_ADDRESS: '0x1111111111111111111111111111111111111111',
  ARC_RPC_URL: 'https://rpc.testnet.arc.network',
  ARC_EXPLORER_URL: 'https://testnet.arcscan.app',
};

function issues(overrides: Record<string, string | undefined>) {
  const result = parseEnvironment({ ...complete, ...overrides }, { production: true });
  return result.ok ? [] : result.issues;
}

describe('runtime configuration', () => {
  it('accepts a complete production environment and reports live mode', () => {
    const result = parseEnvironment(complete, { production: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.public.mode).toBe('live');
    expect(result.config.public.factoryAddress).toBe('0x1111111111111111111111111111111111111111');
    expect(result.config.public.chainId).toBe(5_042_002);
    expect(result.config.public.accountTargetUnits).toBe('100000000');
    expect(result.config.public.agentGasTopUpUnits).toBe('1000000');
  });

  it('rejects a missing or invalid public factory address', () => {
    expect(issues({ FACTORY_ADDRESS: undefined })).toContainEqual({
      field: 'FACTORY_ADDRESS',
      problem: 'required',
    });
    expect(issues({ FACTORY_ADDRESS: '0xnotanaddress' })).toContainEqual({
      field: 'FACTORY_ADDRESS',
      problem: 'invalid_address',
    });
  });

  it('rejects a signer ID configured without its private key, and the reverse', () => {
    expect(issues({ PRIVY_AUTHORIZATION_PRIVATE_KEY: undefined })).toContainEqual({
      field: 'PRIVY_AUTHORIZATION_PRIVATE_KEY',
      problem: 'unpaired',
    });
    expect(issues({ PRIVY_AUTHORIZATION_KEY_ID: undefined })).toContainEqual({
      field: 'PRIVY_AUTHORIZATION_KEY_ID',
      problem: 'unpaired',
    });
  });

  it('requires HTTPS for public production URLs and rejects a foreign chain ID', () => {
    expect(issues({ APP_ORIGIN: 'http://gol.example.com' })).toContainEqual({
      field: 'APP_ORIGIN',
      problem: 'requires_https',
    });
    expect(issues({ ARC_RPC_URL: 'http://rpc.internal' })).toContainEqual({
      field: 'ARC_RPC_URL',
      problem: 'requires_https',
    });
    expect(issues({ ARC_CHAIN_ID: '1' })).toContainEqual({
      field: 'ARC_CHAIN_ID',
      problem: 'invalid_chain_id',
    });
  });

  it('names fields without echoing any configured value', () => {
    const reported = issues({
      PRIVY_APP_SECRET: undefined,
      DATABASE_URL: undefined,
    });
    expect(reported.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(['PRIVY_APP_SECRET', 'DATABASE_URL']),
    );
    expect(JSON.stringify(reported)).not.toContain('gol.example.com');
    expect(JSON.stringify(reported)).not.toContain('authorization-private-key');
  });

  it('falls back to labeled fixture mode outside production', () => {
    const result = parseEnvironment({}, { production: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.public.mode).toBe('fixture');
    expect(result.config.public.privyAppId).toBeNull();
  });

  it('allows an explicitly labeled fixture build without production credentials', () => {
    const result = parseEnvironment({ GOL_FIXTURE_MODE: 'true' }, { production: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.public.mode).toBe('fixture');
  });
});
