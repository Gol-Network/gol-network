import { AuthenticationError, PrivyClient, PermissionDeniedError } from '@privy-io/node';
import { ARC_TESTNET_CAIP2, addressSchema, type Address, type Hex32 } from '@gol/protocol';
import { getAddress, keccak256, recoverTransactionAddress, toHex } from 'viem';
import {
  SignerPolicyError,
  SignerConfigurationError,
  type ScopedAgentSigner,
  type Submission,
  type TransactionRequest,
} from '../payment/types.js';
import {
  SignerAddressMismatchError,
  SignerCryptoError,
  type AgentSigner,
  type SignedTransaction,
  type UnsignedEip1559Transaction,
} from '../signers/types.js';

interface PrivySignerCredentials {
  appId: string;
  appSecret: string;
  authorizationPrivateKey: string;
}

export class PrivyScopedSigner implements ScopedAgentSigner {
  readonly #client: PrivyClient;

  constructor(
    private readonly walletId: string,
    credentials: PrivySignerCredentials,
  ) {
    if (
      !walletId ||
      !credentials.appId ||
      !credentials.appSecret ||
      !credentials.authorizationPrivateKey
    ) {
      throw new Error('Privy signer configuration is incomplete');
    }
    this.#client = new PrivyClient({ appId: credentials.appId, appSecret: credentials.appSecret });
    this.authorizationPrivateKey = credentials.authorizationPrivateKey;
  }

  private readonly authorizationPrivateKey: string;

  async sendTransaction(request: TransactionRequest): Promise<Submission> {
    try {
      const response = await this.#client
        .wallets()
        .ethereum()
        .sendTransaction(this.walletId, {
          caip2: ARC_TESTNET_CAIP2,
          params: {
            transaction: {
              to: request.to,
              value: '0x0',
              data: request.data,
              chain_id: request.chainId,
            },
          },
          ...(request.referenceId
            ? { reference_id: request.referenceId, idempotency_key: request.referenceId }
            : {}),
          authorization_context: {
            authorization_private_keys: [this.authorizationPrivateKey],
          },
        });
      if (!/^0x[0-9a-fA-F]{64}$/.test(response.hash)) {
        throw new Error('Privy returned no transaction hash');
      }
      return {
        txHash: response.hash as Hex32,
        providerOperationId: response.transaction_id ?? null,
      };
    } catch (error) {
      throw classifyPrivySignerError(error);
    }
  }

  async getSubmission(providerOperationId: string): Promise<Submission | null> {
    const transaction = await this.#client.transactions().get(providerOperationId);
    if (!transaction.transaction_hash) return null;
    if (!/^0x[0-9a-fA-F]{64}$/.test(transaction.transaction_hash)) {
      throw new Error('Privy transaction hash is malformed');
    }
    return {
      txHash: transaction.transaction_hash as Hex32,
      providerOperationId: transaction.id,
    };
  }
}

/**
 * Signs a fully constructed EIP-1559 transaction inside Privy's enclave and returns the exact raw
 * bytes for the worker to persist before broadcasting through the configured Arc RPC. Using
 * `eth_signTransaction` keeps custom-chain RPC trust in GOL and avoids Privy's hosted-chain routing.
 */
export class PrivyTransactionSigner implements AgentSigner {
  readonly provider = 'privy' as const;
  readonly #client: PrivyClient;
  readonly #address: Address;
  readonly #authorizationPrivateKey: string;

  constructor(
    private readonly walletId: string,
    expectedAddress: Address,
    credentials: PrivySignerCredentials,
  ) {
    if (
      !walletId ||
      !credentials.appId ||
      !credentials.appSecret ||
      !credentials.authorizationPrivateKey
    ) {
      throw new SignerCryptoError('PRIVY_SIGNER_CONFIG_INVALID', 'Privy signer is incomplete');
    }
    this.#client = new PrivyClient({ appId: credentials.appId, appSecret: credentials.appSecret });
    this.#address = getAddress(addressSchema.parse(expectedAddress)) as Address;
    this.#authorizationPrivateKey = credentials.authorizationPrivateKey;
  }

  async getAddress(): Promise<Address> {
    return this.#address;
  }

  async signTransaction(transaction: UnsignedEip1559Transaction): Promise<SignedTransaction> {
    if (transaction.type !== 'eip1559' || transaction.value !== 0n) {
      throw new SignerCryptoError(
        'PRIVY_SIGNER_TX_INVALID',
        'Privy signer accepts only zero-value EIP-1559 transactions',
      );
    }
    try {
      const response = await this.#client
        .wallets()
        .ethereum()
        .signTransaction(this.walletId, {
          params: {
            transaction: {
              type: 2,
              chain_id: transaction.chainId,
              nonce: transaction.nonce,
              to: transaction.to,
              value: 0,
              data: transaction.data,
              gas_limit: toHex(transaction.gas),
              max_fee_per_gas: toHex(transaction.maxFeePerGas),
              max_priority_fee_per_gas: toHex(transaction.maxPriorityFeePerGas),
            },
          },
          authorization_context: {
            authorization_private_keys: [this.#authorizationPrivateKey],
          },
        });
      if (!/^0x02[0-9a-fA-F]+$/.test(response.signed_transaction)) {
        throw new SignerCryptoError(
          'PRIVY_SIGNER_RESPONSE_INVALID',
          'Privy returned malformed transaction bytes',
        );
      }
      const rawTransaction = response.signed_transaction as `0x02${string}`;
      const from = (await recoverTransactionAddress({
        serializedTransaction: rawTransaction,
      })) as Address;
      if (from.toLowerCase() !== this.#address.toLowerCase()) {
        throw new SignerAddressMismatchError(
          'Privy signed transaction does not recover the linked agent address',
        );
      }
      return {
        rawTransaction,
        transactionHash: keccak256(rawTransaction) as Hex32,
        from,
        nonce: transaction.nonce,
      };
    } catch (error) {
      throw classifyPrivySignerError(error);
    }
  }
}

export function classifyPrivySignerError(error: unknown): unknown {
  if (error instanceof PermissionDeniedError) {
    return new SignerPolicyError('Privy policy denied request');
  }
  if (
    error instanceof AuthenticationError &&
    error.message.includes('App is not authorized to transact on chain')
  ) {
    return new SignerConfigurationError(
      'SIGNER_CHAIN_UNAUTHORIZED',
      'Privy app is not authorized for the configured chain',
    );
  }
  return error;
}
