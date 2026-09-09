import type { Address, Hex, Hex32 } from '@gol/protocol';
import { concat, hexToBytes, keccak256, parseTransaction, serializeTransaction } from 'viem';
import { privateKeyToAccount, privateKeyToAddress, sign } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import {
  AwsKmsSigner,
  parseDerSignature,
  parseSpkiEcPublicKey,
  type KmsSignerBackend,
} from '../src/signers/aws-kms-signer.js';
import {
  SignerAddressMismatchError,
  SignerCryptoError,
  type UnsignedEip1559Transaction,
} from '../src/signers/types.js';

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
/** DER SubjectPublicKeyInfo prefix for an uncompressed secp256k1 public key. */
const SPKI_PREFIX = '3056301006072a8648ce3d020106052b8104000a034200';

const PRIVATE_KEY = `0x${'a1'.repeat(32)}` as Hex;
const ADDRESS = privateKeyToAddress(PRIVATE_KEY);

function spkiFor(privateKey: Hex): Uint8Array {
  const uncompressed = privateKeyToAccount(privateKey).publicKey; // 0x04 + x + y (65 bytes)
  return hexToBytes(`0x${SPKI_PREFIX}${uncompressed.slice(2)}`);
}

function derInteger(value: bigint): Uint8Array {
  let hex = value.toString(16);
  if (hex.length % 2 === 1) hex = `0${hex}`;
  let bytes = hexToBytes(`0x${hex}`);
  if ((bytes[0]! & 0x80) !== 0) bytes = concat([new Uint8Array([0x00]), bytes]);
  return concat([new Uint8Array([0x02, bytes.length]), bytes]);
}

function derSignature(r: bigint, s: bigint): Uint8Array {
  const body = concat([derInteger(r), derInteger(s)]);
  return concat([new Uint8Array([0x30, body.length]), body]);
}

function backend(options: {
  spki?: Uint8Array;
  sign: (digest: Uint8Array) => Uint8Array | Promise<Uint8Array>;
}): KmsSignerBackend {
  return {
    async getPublicKey() {
      return {
        publicKey: options.spki ?? spkiFor(PRIVATE_KEY),
        keyUsage: 'SIGN_VERIFY',
        keySpec: 'ECC_SECG_P256K1',
        signingAlgorithms: ['ECDSA_SHA_256'],
      };
    },
    async sign(_keyId, digest) {
      return options.sign(digest);
    },
  };
}

const KEY_ARN = 'arn:aws:kms:ap-northeast-1:111122223333:key/1a2b3c';

function unsignedTx(nonce = 3): UnsignedEip1559Transaction {
  return {
    type: 'eip1559',
    chainId: 5042002,
    nonce,
    to: '0x00000000000000000000000000000000000acc17' as Address,
    value: 0n,
    data: `0x${'de'.repeat(20)}` as Hex,
    gas: 120_000n,
    maxFeePerGas: 3_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    accessList: [],
  };
}

async function ecdsaOverDigest(digest: Uint8Array): Promise<{ r: bigint; s: bigint }> {
  const signature = await sign({
    hash: `0x${Buffer.from(digest).toString('hex')}` as Hex32,
    privateKey: PRIVATE_KEY,
  });
  return { r: BigInt(signature.r), s: BigInt(signature.s) };
}

describe('SPKI to Ethereum address derivation', () => {
  it('derives the same checksum address as an independent implementation', async () => {
    const signer = new AwsKmsSigner({
      keyArn: KEY_ARN,
      region: 'ap-northeast-1',
      expectedAddress: ADDRESS,
      backend: backend({ sign: () => new Uint8Array() }),
    });
    await expect(signer.getAddress()).resolves.toBe(ADDRESS);
  });

  it('returns the 64-byte coordinates without the 0x04 prefix', () => {
    const coordinates = parseSpkiEcPublicKey(spkiFor(PRIVATE_KEY));
    expect(coordinates).toHaveLength(64);
    expect(privateKeyToAccount(PRIVATE_KEY).publicKey.slice(4)).toBe(
      Buffer.from(coordinates).toString('hex'),
    );
  });

  it('fails closed when the derived address does not match configuration', async () => {
    const signer = new AwsKmsSigner({
      keyArn: KEY_ARN,
      region: 'ap-northeast-1',
      expectedAddress: '0x000000000000000000000000000000000000dEaD',
      backend: backend({ sign: () => new Uint8Array() }),
    });
    await expect(signer.getAddress()).rejects.toBeInstanceOf(SignerAddressMismatchError);
  });

  it('rejects a SubjectPublicKeyInfo for the wrong curve', () => {
    // NIST P-256 named-curve OID instead of secp256k1.
    const wrong = hexToBytes(
      `0x3059301306072a8648ce3d020106082a8648ce3d030107034200${'00'.repeat(64)}`,
    );
    expect(() => parseSpkiEcPublicKey(wrong)).toThrow(SignerCryptoError);
  });
});

describe('transaction signing', () => {
  it('produces a recoverable low-s signed transaction with a locally computed hash', async () => {
    const transaction = unsignedTx();
    const digestHex = keccak256(serializeTransaction(transaction));
    const { r, s } = await ecdsaOverDigest(hexToBytes(digestHex));

    const signer = new AwsKmsSigner({
      keyArn: KEY_ARN,
      region: 'ap-northeast-1',
      expectedAddress: ADDRESS,
      backend: backend({ sign: () => derSignature(r, s) }),
    });
    const signed = await signer.signTransaction(transaction);

    expect(signed.from).toBe(ADDRESS);
    expect(signed.nonce).toBe(3);
    expect(signed.transactionHash).toBe(keccak256(signed.rawTransaction));
    const parsed = parseTransaction(signed.rawTransaction);
    expect(parsed).toMatchObject({ nonce: 3, chainId: 5042002, to: transaction.to });
    expect(parsed.value ?? 0n).toBe(0n);
    expect(parsed.data).toBe(transaction.data);
    expect(BigInt(parsed.s ?? 0n) <= SECP256K1_N >> 1n).toBe(true);
  });

  it('normalizes a high-s signature to the same canonical transaction', async () => {
    const transaction = unsignedTx(5);
    const digestHex = keccak256(serializeTransaction(transaction));
    const { r, s } = await ecdsaOverDigest(hexToBytes(digestHex));

    const low = await new AwsKmsSigner({
      keyArn: KEY_ARN,
      region: 'ap-northeast-1',
      expectedAddress: ADDRESS,
      backend: backend({ sign: () => derSignature(r, s) }),
    }).signTransaction(transaction);

    const high = await new AwsKmsSigner({
      keyArn: KEY_ARN,
      region: 'ap-northeast-1',
      expectedAddress: ADDRESS,
      backend: backend({ sign: () => derSignature(r, SECP256K1_N - s) }),
    }).signTransaction(transaction);

    expect(high.rawTransaction).toBe(low.rawTransaction);
    expect(high.from).toBe(ADDRESS);
  });

  it('accepts a DER integer carrying a leading zero byte', async () => {
    const transaction = unsignedTx(1);
    const digestHex = keccak256(serializeTransaction(transaction));
    const { r, s } = await ecdsaOverDigest(hexToBytes(digestHex));
    // Force a leading zero on r regardless of its high bit.
    const paddedR = concat([
      new Uint8Array([0x00]),
      hexToBytes(`0x${r.toString(16).padStart(64, '0')}`),
    ]);
    const der = (() => {
      const rField = concat([new Uint8Array([0x02, paddedR.length]), paddedR]);
      const sField = derInteger(s);
      const body = concat([rField, sField]);
      return concat([new Uint8Array([0x30, body.length]), body]);
    })();

    const signed = await new AwsKmsSigner({
      keyArn: KEY_ARN,
      region: 'ap-northeast-1',
      expectedAddress: ADDRESS,
      backend: backend({ sign: () => der }),
    }).signTransaction(transaction);
    expect(signed.from).toBe(ADDRESS);
  });

  it('rejects malformed DER, zero, and out-of-range signature values', async () => {
    const transaction = unsignedTx();
    const make = (sig: () => Uint8Array) =>
      new AwsKmsSigner({
        keyArn: KEY_ARN,
        region: 'ap-northeast-1',
        expectedAddress: ADDRESS,
        backend: backend({ sign: sig }),
      }).signTransaction(transaction);

    await expect(make(() => new Uint8Array([0x30, 0x00]))).rejects.toBeInstanceOf(
      SignerCryptoError,
    );
    await expect(make(() => derSignature(0n, 1n))).rejects.toBeInstanceOf(SignerCryptoError);
    await expect(make(() => derSignature(SECP256K1_N, 1n))).rejects.toBeInstanceOf(
      SignerCryptoError,
    );
    await expect(make(() => derSignature(1n, 2n))).rejects.toBeInstanceOf(SignerCryptoError); // wrong key
  });

  it('rejects a signature from a different key', async () => {
    const transaction = unsignedTx();
    const digestHex = keccak256(serializeTransaction(transaction));
    const other = await sign({ hash: digestHex, privateKey: `0x${'b2'.repeat(32)}` });
    await expect(
      new AwsKmsSigner({
        keyArn: KEY_ARN,
        region: 'ap-northeast-1',
        expectedAddress: ADDRESS,
        backend: backend({ sign: () => derSignature(BigInt(other.r), BigInt(other.s)) }),
      }).signTransaction(transaction),
    ).rejects.toBeInstanceOf(SignerCryptoError);
  });
});

describe('parseDerSignature', () => {
  it('parses r and s and strips a leading zero', () => {
    const parsed = parseDerSignature(derSignature(0x80n, 0x01n));
    expect(parsed).toEqual({ r: 0x80n, s: 0x01n });
  });

  it('rejects trailing bytes after the SEQUENCE', () => {
    const good = derSignature(1n, 2n);
    const trailing = concat([good, new Uint8Array([0x00])]);
    expect(() => parseDerSignature(trailing)).toThrow(SignerCryptoError);
  });
});
