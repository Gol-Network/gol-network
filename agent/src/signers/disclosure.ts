import { ARC_TESTNET_CAIP2, ARC_TESTNET_CHAIN_ID, type Address } from '@gol/protocol';

/**
 * Plain-language disclosure shown to the owner before an AWS KMS-backed agent address is linked.
 *
 * KMS custodies a non-exportable key and controls which AWS principal may sign. It cannot inspect an
 * Ethereum digest, so it does not understand mandate policy: the on-chain `GolAccount` is the payment
 * authority, and the owner wallet stays in Privy.
 */
export function kmsAgentDisclosure(agentAddress: Address | null) {
  return {
    provider: 'aws_kms' as const,
    label: 'AWS KMS-backed agent' as const,
    purpose:
      'Submit GOL payment requests to your account contract under an owner-signed on-chain mandate.',
    chain: ARC_TESTNET_CAIP2,
    chainId: ARC_TESTNET_CHAIN_ID,
    agentAddress,
    keyCustody:
      'The agent key is a non-exportable AWS KMS key. The worker signs a fixed transaction envelope; KMS cannot enforce it.',
    controls:
      'The GOL account contract enforces recipient, per-payment cap, cumulative cap, expiry, and revocation. KMS does not.',
    ownerWallet: 'Your owner wallet remains in Privy and is never held by the backend.',
    revocation:
      'Revoke the mandate from your owner wallet at any time. The contract refuses later agent requests even if the key still exists.',
  };
}

export type KmsAgentDisclosure = ReturnType<typeof kmsAgentDisclosure>;
