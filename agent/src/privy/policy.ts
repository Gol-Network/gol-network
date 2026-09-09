import { ARC_TESTNET_CAIP2, ARC_TESTNET_CHAIN_ID, type Address } from '@gol/protocol';

/**
 * One canonical description of the restricted agent signer policy.
 *
 * Provisioning sends this object to Privy, the local assertion evaluates the same rules, and the
 * consent screen displays the same disclosure. There is deliberately no second description that
 * could drift from what Privy actually enforces.
 *
 * The policy constrains the transaction envelope only. It is not an ABI-level allowlist: no
 * `ethereum_calldata` condition is enabled, so it must never be described as `pay`-only.
 */
export const AGENT_POLICY_VERSION = '1.0';
export const PRIVY_POLICY_NAME_MAX_LENGTH = 50;

export type PolicyField = 'chain_id' | 'to' | 'value';

export interface PolicyCondition {
  field_source: 'ethereum_transaction';
  field: PolicyField;
  operator: 'eq';
  value: string;
}

export interface PolicyRule {
  name: string;
  action: 'ALLOW';
  method: 'eth_sendTransaction';
  conditions: PolicyCondition[];
}

export interface AgentSignerPolicy {
  chain_type: 'ethereum';
  name: string;
  version: typeof AGENT_POLICY_VERSION;
  rules: PolicyRule[];
}

export interface PolicyEnvelope {
  method: string;
  chainId: number | string;
  to: Address | null;
  value: bigint;
}

export function agentPolicyName(account: Address): string {
  return `GOL ${account.slice(0, 10)} zero-value account calls`;
}

export function buildAgentSignerPolicy(account: Address): AgentSignerPolicy {
  return {
    chain_type: 'ethereum',
    name: agentPolicyName(account),
    version: AGENT_POLICY_VERSION,
    rules: [
      {
        // Privy rejects rule names at or above 50 characters.
        name: 'GOL account calls on Arc testnet',
        action: 'ALLOW',
        method: 'eth_sendTransaction',
        conditions: [
          {
            field_source: 'ethereum_transaction',
            field: 'chain_id',
            operator: 'eq',
            value: String(ARC_TESTNET_CHAIN_ID),
          },
          { field_source: 'ethereum_transaction', field: 'to', operator: 'eq', value: account },
          { field_source: 'ethereum_transaction', field: 'value', operator: 'eq', value: '0' },
        ],
      },
    ],
  };
}

/**
 * Plain-language disclosure shown to the owner before the agent wallet is provisioned. Every field
 * is derived from the policy that is actually submitted to Privy.
 */
export function agentPolicyDisclosure(account: Address) {
  const policy = buildAgentSignerPolicy(account);
  return {
    purpose: 'Submit GOL payment requests to your account contract and nothing else.',
    policyName: policy.name,
    chain: ARC_TESTNET_CAIP2,
    chainId: ARC_TESTNET_CHAIN_ID,
    destination: account,
    allowedMethod: 'eth_sendTransaction' as const,
    nativeValue: '0' as const,
    defaultAction: 'DENY' as const,
    calldataRestricted: false,
    revocation:
      'Revoke the mandate from your owner wallet. The contract refuses later agent requests even if the signer still exists.',
  };
}

function normalizeChainId(chainId: number | string): string {
  const text = String(chainId);
  if (text.startsWith('eip155:')) return text.slice('eip155:'.length);
  if (text.startsWith('0x')) return BigInt(text).toString();
  return text;
}

/** Mirrors Privy's default-deny evaluation for the single allow rule this policy contains. */
export function evaluateAgentPolicy(
  policy: AgentSignerPolicy,
  envelope: PolicyEnvelope,
): 'ALLOW' | 'DENY' {
  const chainId = normalizeChainId(envelope.chainId);
  for (const rule of policy.rules) {
    if (rule.action !== 'ALLOW' || rule.method !== envelope.method) continue;
    const satisfied = rule.conditions.every((condition) => {
      if (condition.field === 'chain_id') return condition.value === chainId;
      if (condition.field === 'to') {
        return envelope.to !== null && condition.value.toLowerCase() === envelope.to.toLowerCase();
      }
      return BigInt(condition.value) === envelope.value;
    });
    if (satisfied) return 'ALLOW';
  }
  return 'DENY';
}

export function assertPolicyTransaction(policy: AgentSignerPolicy, envelope: PolicyEnvelope): void {
  if (evaluateAgentPolicy(policy, envelope) !== 'ALLOW') throw new Error('SIGNER_POLICY_DENIED');
}
