import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_RPC_URL,
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
  http,
  type EIP1193Provider,
  type Hash,
} from 'viem';
import { arcTestnet } from './chain';

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

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_TESTNET_RPC_URL),
});

async function ownerClient(provider: OwnerProvider) {
  const chainId = await provider.request({ method: 'eth_chainId' });
  if (Number(chainId) !== ARC_TESTNET_CHAIN_ID) throw new Error('WRONG_CHAIN');
  const addresses = (await provider.request({ method: 'eth_requestAccounts' })) as Address[];
  const owner = addresses[0];
  if (!owner) throw new Error('OWNER_WALLET_REQUIRED');
  return {
    owner,
    client: createWalletClient({
      account: owner,
      chain: arcTestnet,
      transport: custom(provider as EIP1193Provider),
    }),
  };
}

async function confirmed(hash: Hash): Promise<Hash> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== 'success') throw new Error('OWNER_TRANSACTION_REVERTED');
  return hash;
}

export async function createAccount(provider: OwnerProvider, factory: Address) {
  const { owner, client } = await ownerClient(provider);
  const hash = await client.writeContract({
    address: factory,
    abi: golAccountFactoryAbi,
    functionName: 'createAccount',
  });
  await confirmed(hash);
  const account = await publicClient.readContract({
    address: factory,
    abi: golAccountFactoryAbi,
    functionName: 'accounts',
    args: [owner],
  });
  if (account === '0x0000000000000000000000000000000000000000')
    throw new Error('ACCOUNT_NOT_CREATED');
  return { owner, account, hash };
}

export async function fundAccount(provider: OwnerProvider, account: Address, amount: bigint) {
  const { client } = await ownerClient(provider);
  const hash = await client.writeContract({
    address: ARC_TESTNET_USDC,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [account, amount],
  });
  return confirmed(hash);
}

export async function createMandate(
  provider: OwnerProvider,
  account: Address,
  draft: MandateDraft,
) {
  const { client } = await ownerClient(provider);
  const hash = await client.writeContract({
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
  });
  return confirmed(hash);
}

export async function revokeMandate(provider: OwnerProvider, account: Address, mandateId: bigint) {
  const { client } = await ownerClient(provider);
  const hash = await client.writeContract({
    address: account,
    abi: golAccountAbi,
    functionName: 'revokeMandate',
    args: [mandateId],
  });
  return confirmed(hash);
}

export async function withdraw(provider: OwnerProvider, account: Address, amount: bigint) {
  const { client } = await ownerClient(provider);
  const hash = await client.writeContract({
    address: account,
    abi: golAccountAbi,
    functionName: 'withdraw',
    args: [amount],
  });
  return confirmed(hash);
}

export async function readAccount(account: Address) {
  const [owner, balance, activeMandateId] = await Promise.all([
    publicClient.readContract({ address: account, abi: golAccountAbi, functionName: 'owner' }),
    publicClient.readContract({
      address: ARC_TESTNET_USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
    }),
    publicClient.readContract({
      address: account,
      abi: golAccountAbi,
      functionName: 'activeMandateId',
    }),
  ]);
  if (activeMandateId === 0n) return { owner, balance, activeMandateId, mandate: null };
  const mandate = await publicClient.readContract({
    address: account,
    abi: golAccountAbi,
    functionName: 'getMandate',
    args: [activeMandateId],
  });
  return { owner, balance, activeMandateId, mandate };
}
