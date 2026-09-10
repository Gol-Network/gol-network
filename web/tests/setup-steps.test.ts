import { describe, expect, it } from 'vitest';
import type { Address } from '@gol/protocol';
import type { PublicConfig } from '@/config';
import type { AccountSnapshot } from '@/client/types';
import { deriveSteps } from '@/components/setup-steps';

const address = (suffix: string) => `0x${suffix.padStart(40, '0')}` as Address;

const config: PublicConfig = {
  mode: 'live',
  privyAppId: 'test-app',
  factoryAddress: address('1'),
  agentSignerProvider: 'privy',
  agentSignerAddress: null,
  agentGasManaged: true,
  chainId: 5_042_002,
  chainName: 'Arc testnet',
  rpcUrl: 'https://rpc.testnet.arc.network',
  explorerUrl: 'https://testnet.arcscan.app',
  faucetUrl: 'https://faucet.circle.com',
  recipientLabel: 'Design contractor',
  accountTargetUnits: '100000000',
  agentGasTopUpUnits: '1000000',
  minOwnerGasWei: '1',
  minAgentGasWei: '1',
};

function snapshot(linked: boolean): AccountSnapshot {
  return {
    ownerAddress: address('2'),
    accountAddress: address('3'),
    agentAddress: address('4'),
    linked,
    policyId: 'policy-id',
    policyDisclosure: null,
    recipients: [],
    balances: {
      ownerUsdcUnits: '1000000',
      accountUsdcUnits: '1000000',
      ownerGasWei: '1',
      agentGasWei: '0',
    },
    activeMandateId: '1',
    mandate: {
      agent: address('4'),
      perPaymentCapUnits: '100000000',
      cumulativeCapUnits: '100000000',
      spentUnits: '0',
      expiresAt: '9999999999',
      revoked: false,
    },
  };
}

describe('setup step derivation', () => {
  it('requires signer reprovisioning when a stored agent uses an obsolete policy', () => {
    const steps = deriveSteps({ config, authenticated: true, account: snapshot(false) });
    expect(steps.find((step) => step.id === 'agent_wallet')).toMatchObject({
      status: 'current',
      action: 'provision_agent',
    });
  });

  it('accepts the agent only after the backend verifies the current policy revision', () => {
    const steps = deriveSteps({ config, authenticated: true, account: snapshot(true) });
    expect(steps.find((step) => step.id === 'agent_wallet')?.status).toBe('complete');
  });

  it('requires a new mandate after the restricted agent is rotated', () => {
    const account = snapshot(true);
    account.agentAddress = address('5');
    account.balances.agentGasWei = '1';
    const steps = deriveSteps({ config, authenticated: true, account });
    expect(steps.find((step) => step.id === 'mandate')).toMatchObject({
      status: 'current',
      action: 'sign_mandate',
    });
  });

  it('blocks setup with faucet guidance while operator-managed agent gas is empty', () => {
    const steps = deriveSteps({ config, authenticated: true, account: snapshot(true) });
    expect(steps.find((step) => step.id === 'agent_gas')).toMatchObject({
      status: 'blocked',
      action: null,
    });
  });
});
