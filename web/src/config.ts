import type { Address } from '@gol/protocol';

/**
 * Non-secret configuration that server components hand to client components as typed props.
 *
 * Nothing here is read from `NEXT_PUBLIC_*` at build time: the same production image is configured
 * when it starts, not when it is built.
 */
export interface PublicConfig {
  /** `live` once Privy and the factory address are configured, otherwise a labeled fixture demo. */
  mode: 'live' | 'fixture';
  privyAppId: string | null;
  factoryAddress: Address | null;
  /** Active agent signer provider. Privy still authenticates the owner in both modes. */
  agentSignerProvider: 'privy' | 'aws_kms';
  /** The shared AWS KMS agent address, when `agentSignerProvider` is `aws_kms`. Public, non-secret. */
  agentSignerAddress: Address | null;
  /**
   * When true, the GOL operator funds the agent's gas reserve and the owner is never asked to top
   * it up. Defaults to true for `aws_kms` (one shared agent address), overridable with
   * `AGENT_GAS_MANAGED`.
   */
  agentGasManaged: boolean;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl: string | null;
  /** Approved-recipient label used by the demonstration instructions. */
  recipientLabel: string;
  /** Exact USDC balance the GOL account is funded to, in six-decimal units. */
  accountTargetUnits: string;
  /** Owner-to-agent gas top-up amount, in six-decimal USDC units. */
  agentGasTopUpUnits: string;
  /** Minimum native gas balances, in wei, below which an owner action is not requested. */
  minOwnerGasWei: string;
  minAgentGasWei: string;
}

export function explorerAddressUrl(config: PublicConfig, address: string): string {
  return `${config.explorerUrl.replace(/\/$/, '')}/address/${address}`;
}

export function explorerTxUrl(config: PublicConfig, hash: string): string {
  return `${config.explorerUrl.replace(/\/$/, '')}/tx/${hash}`;
}
