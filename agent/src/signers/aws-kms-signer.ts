import type { Address, Hex, Hex32 } from '@gol/protocol';
import {
  bytesToHex,
  getAddress,
  hexToBytes,
  keccak256,
  recoverAddress,
  serializeTransaction,
} from 'viem';
import {
  SignerAddressMismatchError,
  SignerCryptoError,
  type AgentSigner,
  type SignedTransaction,
  type UnsignedEip1559Transaction,
} from './types.js';

/** secp256k1 group order. */
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const SECP256K1_HALF_N = SECP256K1_N >> 1n;

/** DER OID bytes for `id-ecPublicKey` (1.2.840.10045.2.1). */
const OID_EC_PUBLIC_KEY = '06072a8648ce3d0201';
/** DER OID bytes for the `secp256k1` named curve (1.3.132.0.10). */
const OID_SECP256K1 = '06052b8104000a';

/**
 * Minimal AWS KMS surface the signer depends on. The worker builds the real client; tests supply a
 * double so the cryptography can be verified against fixtures without AWS credentials.
 */
export interface KmsSignerBackend {
  getPublicKey(keyId: string): Promise<{
    publicKey: Uint8Array;
    keyUsage?: string;
    keySpec?: string;
    signingAlgorithms?: readonly string[];
  }>;
  /** Returns the ASN.1 DER ECDSA signature over the supplied 32-byte digest. */
  sign(keyId: string, digest: Uint8Array): Promise<Uint8Array>;
}

export interface AwsKmsSignerConfig {
  /** Exact production signing key ARN. */
  keyArn: string;
  region: string;
  /** EIP-55 address the operator configured. Startup fails closed on any mismatch. */
  expectedAddress: Address;
  backend: KmsSignerBackend;
}

export class AwsKmsSigner implements AgentSigner {
  readonly provider = 'aws_kms' as const;

  #cache: { publicKey: Uint8Array; address: Address } | null = null;

  constructor(private readonly config: AwsKmsSignerConfig) {
    if (!config.keyArn.startsWith('arn:aws:kms:')) {
      throw new SignerCryptoError(
        'SIGNER_KEY_ARN_INVALID',
        'AWS_KMS_SIGNER_KEY_ARN is not a KMS ARN',
      );
    }
    getAddress(config.expectedAddress);
  }

  async getAddress(): Promise<Address> {
    return (await this.load()).address;
  }

  /**
   * Confirms the derived address matches configuration and every supplied linked-account address.
   * Call once on startup; a mismatch must stop the worker.
   */
  async verify(linkedAddresses: readonly string[] = []): Promise<Address> {
    const { address } = await this.load();
    for (const linked of linkedAddresses) {
      if (linked.toLowerCase() !== address.toLowerCase()) {
        throw new SignerAddressMismatchError(
          'Derived KMS address does not match a linked account row',
        );
      }
    }
    return address;
  }

  async signTransaction(transaction: UnsignedEip1559Transaction): Promise<SignedTransaction> {
    const { address } = await this.load();
    assertUnsigned(transaction);

    const serializable = {
      type: 'eip1559' as const,
      chainId: transaction.chainId,
      nonce: transaction.nonce,
      to: transaction.to,
      value: transaction.value,
      data: transaction.data,
      gas: transaction.gas,
      maxFeePerGas: transaction.maxFeePerGas,
      maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
      accessList: [] as [],
    };

    const unsignedSerialized = serializeTransaction(serializable);
    const digest = hexToBytes(keccak256(unsignedSerialized));

    const der = await this.config.backend.sign(this.config.keyArn, digest);
    const { r, s } = parseDerSignature(der);

    // Ethereum requires the low-s form; recovery parity is brute-forced, so no v flip is needed.
    const normalizedS = s > SECP256K1_HALF_N ? SECP256K1_N - s : s;

    const rHex = toHex32(r);
    const sHex = toHex32(normalizedS);
    const digestHex = keccak256(unsignedSerialized);

    let matched: 0 | 1 | null = null;
    for (const yParity of [0, 1] as const) {
      const recovered = await recoverAddress({
        hash: digestHex,
        signature: { r: rHex, s: sHex, yParity },
      });
      if (recovered.toLowerCase() === address.toLowerCase()) {
        if (matched !== null) {
          throw new SignerCryptoError(
            'SIGNER_RECOVERY_AMBIGUOUS',
            'Both recovery parities recovered the KMS address',
          );
        }
        matched = yParity;
      }
    }
    if (matched === null) {
      throw new SignerCryptoError(
        'SIGNER_RECOVERY_FAILED',
        'No recovery parity recovered the configured KMS address',
      );
    }

    const rawTransaction = serializeTransaction(serializable, {
      r: rHex,
      s: sHex,
      yParity: matched,
    });
    const transactionHash = keccak256(rawTransaction) as Hex32;
    return {
      rawTransaction,
      transactionHash,
      from: address,
      nonce: transaction.nonce,
    };
  }

  private async load(): Promise<{ publicKey: Uint8Array; address: Address }> {
    if (this.#cache) return this.#cache;
    const response = await this.config.backend.getPublicKey(this.config.keyArn);
    if (response.keyUsage !== undefined && response.keyUsage !== 'SIGN_VERIFY') {
      throw new SignerCryptoError('SIGNER_KEY_USAGE_INVALID', 'KMS key usage is not SIGN_VERIFY');
    }
    if (response.keySpec !== undefined && response.keySpec !== 'ECC_SECG_P256K1') {
      throw new SignerCryptoError('SIGNER_KEY_SPEC_INVALID', 'KMS key spec is not ECC_SECG_P256K1');
    }
    if (
      response.signingAlgorithms !== undefined &&
      !response.signingAlgorithms.includes('ECDSA_SHA_256')
    ) {
      throw new SignerCryptoError(
        'SIGNER_KEY_ALGO_INVALID',
        'KMS key does not support ECDSA_SHA_256',
      );
    }

    const uncompressed = parseSpkiEcPublicKey(response.publicKey);
    const address = getAddress(`0x${keccak256(bytesToHex(uncompressed)).slice(-40)}`) as Address;
    if (address.toLowerCase() !== this.config.expectedAddress.toLowerCase()) {
      throw new SignerAddressMismatchError(
        'Derived KMS address does not match AWS_KMS_SIGNER_ADDRESS',
      );
    }
    this.#cache = { publicKey: uncompressed, address };
    return this.#cache;
  }
}

function assertUnsigned(transaction: UnsignedEip1559Transaction): void {
  if (transaction.type !== 'eip1559') {
    throw new SignerCryptoError('SIGNER_TX_TYPE_INVALID', 'Only EIP-1559 transactions are signed');
  }
  if (transaction.value !== 0n) {
    throw new SignerCryptoError('SIGNER_TX_VALUE_INVALID', 'Agent transactions carry zero value');
  }
  if (!Number.isInteger(transaction.nonce) || transaction.nonce < 0) {
    throw new SignerCryptoError('SIGNER_TX_NONCE_INVALID', 'Nonce must be a non-negative integer');
  }
  if (transaction.accessList.length !== 0) {
    throw new SignerCryptoError('SIGNER_TX_ACCESS_LIST', 'Access list must be empty');
  }
}

/**
 * Parses a DER-encoded SubjectPublicKeyInfo for an secp256k1 public key and returns the 64-byte
 * `x || y` coordinates without the `0x04` prefix.
 */
export function parseSpkiEcPublicKey(der: Uint8Array): Uint8Array {
  const root = readTlv(der, 0);
  if (root.tag !== 0x30) {
    throw new SignerCryptoError('SIGNER_SPKI_INVALID', 'SubjectPublicKeyInfo is not a SEQUENCE');
  }
  if (root.end !== der.length) {
    throw new SignerCryptoError('SIGNER_SPKI_INVALID', 'SubjectPublicKeyInfo has trailing bytes');
  }

  const algorithm = readTlv(der, root.contentStart);
  if (algorithm.tag !== 0x30) {
    throw new SignerCryptoError('SIGNER_SPKI_INVALID', 'AlgorithmIdentifier is not a SEQUENCE');
  }
  const algorithmBytes = bytesToHex(der.subarray(algorithm.contentStart, algorithm.end));
  if (!algorithmBytes.includes(OID_EC_PUBLIC_KEY.slice(2))) {
    throw new SignerCryptoError('SIGNER_SPKI_INVALID', 'Public key is not id-ecPublicKey');
  }
  if (!algorithmBytes.includes(OID_SECP256K1.slice(2))) {
    throw new SignerCryptoError('SIGNER_SPKI_INVALID', 'Named curve is not secp256k1');
  }

  const subjectPublicKey = readTlv(der, algorithm.end);
  if (subjectPublicKey.tag !== 0x03) {
    throw new SignerCryptoError('SIGNER_SPKI_INVALID', 'subjectPublicKey is not a BIT STRING');
  }
  const bitString = der.subarray(subjectPublicKey.contentStart, subjectPublicKey.end);
  if (bitString.length !== 66 || bitString[0] !== 0x00 || bitString[1] !== 0x04) {
    throw new SignerCryptoError(
      'SIGNER_SPKI_INVALID',
      'BIT STRING is not an uncompressed secp256k1 point',
    );
  }
  return bitString.subarray(2);
}

/** Strictly parses an ASN.1 DER ECDSA signature into `r` and `s` bigints, rejecting bad values. */
export function parseDerSignature(der: Uint8Array): { r: bigint; s: bigint } {
  const root = readTlv(der, 0);
  if (root.tag !== 0x30) {
    throw new SignerCryptoError('SIGNER_SIG_INVALID', 'DER signature is not a SEQUENCE');
  }
  if (root.end !== der.length) {
    throw new SignerCryptoError('SIGNER_SIG_INVALID', 'DER signature has trailing bytes');
  }

  const rField = readTlv(der, root.contentStart);
  if (rField.tag !== 0x02) {
    throw new SignerCryptoError('SIGNER_SIG_INVALID', 'r is not an INTEGER');
  }
  const sField = readTlv(der, rField.end);
  if (sField.tag !== 0x02) {
    throw new SignerCryptoError('SIGNER_SIG_INVALID', 's is not an INTEGER');
  }
  if (sField.end !== root.end) {
    throw new SignerCryptoError('SIGNER_SIG_INVALID', 'DER signature SEQUENCE has extra fields');
  }

  const r = derIntegerToBigInt(der.subarray(rField.contentStart, rField.end), 'r');
  const s = derIntegerToBigInt(der.subarray(sField.contentStart, sField.end), 's');
  return { r, s };
}

function derIntegerToBigInt(bytes: Uint8Array, field: string): bigint {
  if (bytes.length === 0) {
    throw new SignerCryptoError('SIGNER_SIG_INVALID', `${field} INTEGER is empty`);
  }
  if ((bytes[0]! & 0x80) !== 0) {
    throw new SignerCryptoError('SIGNER_SIG_INVALID', `${field} INTEGER is negative`);
  }
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0x00) start += 1;
  const trimmed = bytes.subarray(start);
  if (trimmed.length > 32) {
    throw new SignerCryptoError('SIGNER_SIG_INVALID', `${field} INTEGER exceeds 32 bytes`);
  }
  const value = trimmed.length === 0 ? 0n : BigInt(bytesToHex(trimmed));
  if (value === 0n) {
    throw new SignerCryptoError('SIGNER_SIG_INVALID', `${field} is zero`);
  }
  if (value >= SECP256K1_N) {
    throw new SignerCryptoError('SIGNER_SIG_INVALID', `${field} is not in the group order`);
  }
  return value;
}

interface Tlv {
  tag: number;
  contentStart: number;
  end: number;
}

function readTlv(buffer: Uint8Array, offset: number): Tlv {
  if (offset + 2 > buffer.length) {
    throw new SignerCryptoError('SIGNER_DER_INVALID', 'Truncated DER element');
  }
  const tag = buffer[offset]!;
  const first = buffer[offset + 1]!;
  let contentStart: number;
  let length: number;
  if (first < 0x80) {
    length = first;
    contentStart = offset + 2;
  } else {
    const lengthBytes = first & 0x7f;
    if (lengthBytes === 0 || lengthBytes > 4) {
      throw new SignerCryptoError('SIGNER_DER_INVALID', 'Unsupported DER length encoding');
    }
    if (offset + 2 + lengthBytes > buffer.length) {
      throw new SignerCryptoError('SIGNER_DER_INVALID', 'Truncated DER length');
    }
    length = 0;
    for (let index = 0; index < lengthBytes; index += 1) {
      length = (length << 8) | buffer[offset + 2 + index]!;
    }
    contentStart = offset + 2 + lengthBytes;
  }
  const end = contentStart + length;
  if (end > buffer.length) {
    throw new SignerCryptoError('SIGNER_DER_INVALID', 'DER element runs past the buffer');
  }
  return { tag, contentStart, end };
}

function toHex32(value: bigint): Hex {
  return `0x${value.toString(16).padStart(64, '0')}`;
}
