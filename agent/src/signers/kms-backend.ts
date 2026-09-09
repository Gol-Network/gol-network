import { GetPublicKeyCommand, KMSClient, SignCommand } from '@aws-sdk/client-kms';
import { SignerCryptoError } from './types.js';
import type { KmsSignerBackend } from './aws-kms-signer.js';

/**
 * Wraps `@aws-sdk/client-kms` directly. It never shells out to the AWS CLI and never depends on a
 * Foundry credential provider. The worker constructs the underlying {@link KMSClient}; the web
 * process must not.
 */
export function kmsSignerBackend(client: KMSClient): KmsSignerBackend {
  return {
    async getPublicKey(keyId: string) {
      const response = await client.send(new GetPublicKeyCommand({ KeyId: keyId }));
      if (!response.PublicKey) {
        throw new SignerCryptoError('SIGNER_KMS_NO_PUBLIC_KEY', 'KMS returned no public key');
      }
      return {
        publicKey: toUint8Array(response.PublicKey),
        ...(response.KeyUsage ? { keyUsage: response.KeyUsage } : {}),
        ...(response.KeySpec ? { keySpec: response.KeySpec } : {}),
        ...(response.SigningAlgorithms ? { signingAlgorithms: response.SigningAlgorithms } : {}),
      };
    },
    async sign(keyId: string, digest: Uint8Array) {
      const response = await client.send(
        new SignCommand({
          KeyId: keyId,
          Message: digest,
          MessageType: 'DIGEST',
          SigningAlgorithm: 'ECDSA_SHA_256',
        }),
      );
      if (!response.Signature) {
        throw new SignerCryptoError('SIGNER_KMS_NO_SIGNATURE', 'KMS returned no signature');
      }
      return toUint8Array(response.Signature);
    },
  };
}

/** Builds a KMS client bound to one region. Credentials come from the ambient worker identity. */
export function createKmsClient(region: string): KMSClient {
  return new KMSClient({ region, maxAttempts: 4 });
}

function toUint8Array(value: Uint8Array | ArrayBufferLike): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}
