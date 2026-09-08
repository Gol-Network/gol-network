import { PrivyClient, PermissionDeniedError } from '@privy-io/node';
import { ARC_TESTNET_CAIP2, type Hex32 } from '@gol/protocol';
import {
  SignerPolicyError,
  type ScopedAgentSigner,
  type Submission,
  type TransactionRequest,
} from '../payment/types.js';

export class PrivyScopedSigner implements ScopedAgentSigner {
  readonly #client: PrivyClient;

  constructor(
    private readonly walletId: string,
    credentials: {
      appId: string;
      appSecret: string;
      authorizationPrivateKey: string;
    },
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
      if (error instanceof PermissionDeniedError)
        throw new SignerPolicyError('Privy policy denied request');
      throw error;
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
