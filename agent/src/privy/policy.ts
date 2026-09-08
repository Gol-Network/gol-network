import { ARC_TESTNET_CAIP2, type Address } from '@gol/protocol';

export interface AgentSignerPolicy {
  version: '1.0';
  name: string;
  defaultAction: 'DENY';
  rules: Array<{
    method: 'eth_sendTransaction';
    action: 'ALLOW';
    conditions: {
      chainId: string;
      to: Address;
      value: '0x0';
    };
  }>;
}

export function buildAgentSignerPolicy(account: Address): AgentSignerPolicy {
  return {
    version: '1.0',
    name: 'GOL agent pay only',
    defaultAction: 'DENY',
    rules: [
      {
        method: 'eth_sendTransaction',
        action: 'ALLOW',
        conditions: { chainId: ARC_TESTNET_CAIP2, to: account, value: '0x0' },
      },
    ],
  };
}

export function assertPolicyTransaction(
  policy: AgentSignerPolicy,
  transaction: { chainId: string; to: Address; value: bigint },
): void {
  const allowed = policy.rules.some(
    (rule) =>
      rule.method === 'eth_sendTransaction' &&
      rule.conditions.chainId === transaction.chainId &&
      rule.conditions.to.toLowerCase() === transaction.to.toLowerCase() &&
      transaction.value === 0n,
  );
  if (!allowed) throw new Error('SIGNER_POLICY_DENIED');
}
