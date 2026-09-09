import type { Address, Hex, Hex32 } from '@gol/protocol';

/**
 * Provider-neutral agent signer contract.
 *
 * An implementation owns exactly one signing identity. It never accepts a transaction object from
 * HTTP, a model, or the database: the worker constructs the unsigned transaction internally, the
 * envelope validator checks every field against trusted configuration and journal state, and only
 * then is {@link AgentSigner.signTransaction} called. The signer returns the exact serialized bytes
 * and their locally computed hash so the journal can persist a bearer artifact before any broadcast.
 */
export interface AgentSigner {
  /** Stable provider label. Recorded on the account link and surfaced in operator output. */
  readonly provider: SignerProvider;

  /**
   * Returns the EIP-55 checksum address derived from the signer's public key. Implementations must
   * cache the public key and address and must fail closed when the derived address does not match
   * every configured expectation.
   */
  getAddress(): Promise<Address>;

  /**
   * Signs an unsigned EIP-1559 transaction. The implementation serializes the transaction without a
   * signature, hashes it, obtains a signature over that digest, normalizes it for Ethereum, proves
   * exactly one recovery parity recovers the derived address, and returns the serialized signed
   * transaction with its locally computed hash.
   */
  signTransaction(transaction: UnsignedEip1559Transaction): Promise<SignedTransaction>;
}

export type SignerProvider = 'aws_kms' | 'privy';

/** The only transaction shape the agent signer will ever serialize. */
export interface UnsignedEip1559Transaction {
  /** EIP-1559 type-2 transaction. */
  type: 'eip1559';
  chainId: 5042002;
  nonce: number;
  to: Address;
  /** Always zero for `GolAccount.pay`. */
  value: 0n;
  data: Hex;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  /** Empty unless a future change separately specifies and tests a non-empty access list. */
  accessList: readonly [];
}

export interface SignedTransaction {
  /** Exact serialized signed transaction bytes, ready for `eth_sendRawTransaction`. */
  rawTransaction: Hex;
  /** `keccak256(rawTransaction)`, computed locally and never taken from an RPC response. */
  transactionHash: Hex32;
  /** Address recovered from the signature; equal to {@link AgentSigner.getAddress}. */
  from: Address;
  nonce: number;
}

/** Raised before `kms:Sign` when the constructed transaction fails the mandatory envelope check. */
export class SignerEnvelopeRejectedError extends Error {
  readonly code = 'SIGNER_ENVELOPE_REJECTED';

  constructor(
    /** Which envelope field failed. Names only: several inputs are operational secrets. */
    readonly field: string,
    message: string,
  ) {
    super(`${message} (${field})`);
    this.name = 'SignerEnvelopeRejectedError';
  }
}

/** Raised when a signer cannot prove its derived address matches configuration. Fail closed. */
export class SignerAddressMismatchError extends Error {
  readonly code = 'SIGNER_ADDRESS_MISMATCH';

  constructor(message: string) {
    super(message);
    this.name = 'SignerAddressMismatchError';
  }
}

/** Raised for a malformed public key, malformed signature, or an unusable key configuration. */
export class SignerCryptoError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SignerCryptoError';
    this.code = code;
  }
}
