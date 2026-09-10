import {
  ARC_TESTNET_USDC,
  erc20Abi,
  golAccountAbi,
  golAccountFactoryAbi,
  type Address,
} from '@gol/protocol';
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Chain,
  type EIP1193Provider,
  type Hash,
  type PublicClient,
} from 'viem';
import type { PublicConfig } from '@/config';
import type { TransactionPhase, TransactionReporter } from '@/client/types';
import type { PreparedAaveTransaction } from '@/client/aave-transactions';

export interface MandateDraft {
  agent: Address;
  perPaymentCap: bigint;
  cumulativeCap: bigint;
  expiresAt: bigint;
  recipients: Address[];
}

export interface OwnerProvider {
  request(request: { method: string; params?: unknown[] }): Promise<unknown>;
}

export function arcChainFor(config: PublicConfig): Chain {
  return defineChain({
    id: config.chainId,
    name: config.chainName,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
    blockExplorers: { default: { name: 'Arc Explorer', url: config.explorerUrl } },
    testnet: true,
  });
}

export function publicClientFor(config: PublicConfig): PublicClient {
  return createPublicClient({
    chain: arcChainFor(config),
    transport: http(config.rpcUrl),
  }) as PublicClient;
}

export class OwnerTransactionError extends Error {
  constructor(
    readonly phase: TransactionPhase,
    message: string,
    readonly hash: string | null = null,
  ) {
    super(message);
  }
}

async function ownerClient(provider: OwnerProvider, config: PublicConfig) {
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (Number(chainId) !== config.chainId) {
    throw new OwnerTransactionError('failed', 'Switch the wallet to Arc testnet before signing.');
  }
  const addresses = (await provider.request({ method: 'eth_requestAccounts' })) as Address[];
  const owner = addresses[0];
  if (!owner) throw new OwnerTransactionError('failed', 'An owner wallet is required.');
  return {
    owner,
    client: createWalletClient({
      account: owner,
      chain: arcChainFor(config),
      transport: custom(provider as EIP1193Provider),
    }),
  };
}

/** Maps a wallet or node error to a state the owner can act on. */
export function classifyOwnerError(error: unknown): OwnerTransactionError {
  if (error instanceof OwnerTransactionError) return error;
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const code = (error as { code?: unknown })?.code;
  if (code === 4001 || text.includes('user rejected') || text.includes('user denied')) {
    return new OwnerTransactionError('rejected', 'Signature rejected in the wallet.');
  }
  if (text.includes('insufficient funds') || text.includes('gas required exceeds')) {
    return new OwnerTransactionError('insufficient_gas', 'The owner wallet has too little gas.');
  }
  if (text.includes('revert')) {
    return new OwnerTransactionError('reverted', 'The transaction reverted on-chain.');
  }
  return new OwnerTransactionError('failed', 'The transaction could not be completed.');
}

/**
 * Runs one owner transaction and reports every state it passes through: awaiting signature,
 * submitted with its hash, then confirmed, reverted, rejected, or insufficient gas.
 */
async function runOwnerTransaction(
  config: PublicConfig,
  report: TransactionReporter,
  send: () => Promise<Hash>,
): Promise<Hash> {
  report({ phase: 'awaiting_signature' });
  let hash: Hash;
  try {
    hash = await send();
  } catch (error) {
    const classified = classifyOwnerError(error);
    report({ phase: classified.phase, detail: classified.message });
    throw classified;
  }
  report({ phase: 'submitted', hash });
  try {
    const receipt = await publicClientFor(config).waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });
    if (receipt.status !== 'success') {
      report({ phase: 'reverted', hash, detail: 'The transaction reverted on-chain.' });
      throw new OwnerTransactionError('reverted', 'The transaction reverted on-chain.', hash);
    }
  } catch (error) {
    const classified = error instanceof OwnerTransactionError ? error : classifyOwnerError(error);
    report({ phase: classified.phase, hash, detail: classified.message });
    throw classified;
  }
  report({ phase: 'confirmed', hash });
  return hash;
}

export async function createAccount(
  provider: OwnerProvider,
  config: PublicConfig,
  factory: Address,
  report: TransactionReporter,
) {
  const { owner, client } = await ownerClient(provider, config);
  const hash = await runOwnerTransaction(config, report, () =>
    client.writeContract({
      address: factory,
      abi: golAccountFactoryAbi,
      functionName: 'createAccount',
    }),
  );
  const account = await publicClientFor(config).readContract({
    address: factory,
    abi: golAccountFactoryAbi,
    functionName: 'accounts',
    args: [owner],
  });
  if (account === '0x0000000000000000000000000000000000000000') {
    throw new OwnerTransactionError('failed', 'The factory did not record an account.', hash);
  }
  return { owner, account, hash };
}

/** Transfers ERC-20 USDC. On Arc this is the same balance that settles gas for the recipient. */
export async function transferUsdc(
  provider: OwnerProvider,
  config: PublicConfig,
  to: Address,
  amount: bigint,
  report: TransactionReporter,
) {
  const { client } = await ownerClient(provider, config);
  return runOwnerTransaction(config, report, () =>
    client.writeContract({
      address: ARC_TESTNET_USDC,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to, amount],
    }),
  );
}

export async function createMandate(
  provider: OwnerProvider,
  config: PublicConfig,
  account: Address,
  draft: MandateDraft,
  report: TransactionReporter,
) {
  const { client } = await ownerClient(provider, config);
  return runOwnerTransaction(config, report, () =>
    client.writeContract({
      address: account,
      abi: golAccountAbi,
      functionName: 'createMandate',
      args: [
        draft.agent,
        draft.perPaymentCap,
        draft.cumulativeCap,
        draft.expiresAt,
        draft.recipients,
      ],
    }),
  );
}

export async function revokeMandate(
  provider: OwnerProvider,
  config: PublicConfig,
  account: Address,
  mandateId: bigint,
  report: TransactionReporter,
) {
  const { client } = await ownerClient(provider, config);
  return runOwnerTransaction(config, report, () =>
    client.writeContract({
      address: account,
      abi: golAccountAbi,
      functionName: 'revokeMandate',
      args: [mandateId],
    }),
  );
}

export async function withdraw(
  provider: OwnerProvider,
  config: PublicConfig,
  account: Address,
  amount: bigint,
  report: TransactionReporter,
) {
  const { client } = await ownerClient(provider, config);
  return runOwnerTransaction(config, report, () =>
    client.writeContract({
      address: account,
      abi: golAccountAbi,
      functionName: 'withdraw',
      args: [amount],
    }),
  );
}

export async function sendPreparedTransaction(
  provider: OwnerProvider,
  transaction: PreparedAaveTransaction,
  report: TransactionReporter,
) {
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (Number(chainId) !== transaction.chainId) {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${transaction.chainId.toString(16)}` }],
      });
    } catch (error) {
      const classified = classifyOwnerError(error);
      const switchError = new OwnerTransactionError(
        classified.phase,
        'Switch to the prepared Aave network first.',
      );
      report({ phase: switchError.phase, detail: switchError.message });
      throw switchError;
    }
    const switchedChainId = await provider.request({ method: 'eth_chainId' });
    if (Number(switchedChainId) !== transaction.chainId) {
      const switchError = new OwnerTransactionError(
        'failed',
        'The wallet did not switch to the prepared Aave network.',
      );
      report({ phase: switchError.phase, detail: switchError.message });
      throw switchError;
    }
  }

  const addresses = (await provider.request({ method: 'eth_requestAccounts' })) as Address[];
  const owner = addresses[0];
  if (!owner || owner.toLowerCase() !== transaction.from.toLowerCase()) {
    const error = new OwnerTransactionError(
      'failed',
      'The prepared Aave transaction belongs to a different wallet.',
    );
    report({ phase: error.phase, detail: error.message });
    throw error;
  }

  report({ phase: 'awaiting_signature' });
  let hash: Hash;
  try {
    hash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: owner,
          to: transaction.to,
          data: transaction.data,
          value: `0x${BigInt(transaction.value).toString(16)}`,
        },
      ],
    })) as Hash;
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Wallet returned an invalid hash.');
  } catch (error) {
    const classified = classifyOwnerError(error);
    report({ phase: classified.phase, detail: classified.message });
    throw classified;
  }
  report({ phase: 'submitted', hash, detail: `Submitted on chain ${transaction.chainId}.` });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const receipt = (await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [hash],
    })) as { status?: string } | null;
    if (!receipt) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      continue;
    }
    if (receipt.status === '0x0') {
      const error = new OwnerTransactionError('reverted', 'The Aave transaction reverted.', hash);
      report({ phase: error.phase, hash, detail: error.message });
      throw error;
    }
    if (receipt.status !== '0x1') {
      const error = new OwnerTransactionError(
        'failed',
        'The wallet returned an invalid Aave receipt.',
        hash,
      );
      report({ phase: error.phase, hash, detail: error.message });
      throw error;
    }
    report({ phase: 'confirmed', hash, detail: `Confirmed on chain ${transaction.chainId}.` });
    return hash;
  }
  const error = new OwnerTransactionError(
    'failed',
    'The Aave receipt is still pending. Check the wallet before retrying.',
    hash,
  );
  report({ phase: error.phase, hash, detail: error.message });
  throw error;
}

export async function readAccountUsdc(config: PublicConfig, account: Address): Promise<bigint> {
  return publicClientFor(config).readContract({
    address: ARC_TESTNET_USDC,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  });
}

export async function readNativeGas(config: PublicConfig, address: Address): Promise<bigint> {
  return publicClientFor(config).getBalance({ address });
}
