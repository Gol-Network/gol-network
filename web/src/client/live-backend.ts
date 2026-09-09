import {
  ACTIVITY_PAGE_MAX,
  addressSchema,
  golAccountAbi,
  golAccountFactoryAbi,
  type ActivityPage,
  type Address,
  type GroundedAnswer,
} from '@gol/protocol';
import type { PublicConfig } from '@/config';
import {
  createAccount,
  createMandate,
  publicClientFor,
  readAccountUsdc,
  readNativeGas,
  revokeMandate,
  transferUsdc,
  withdraw,
  type OwnerProvider,
} from '@/wallet/owner-actions';
import type {
  AccountSnapshot,
  GolBackend,
  MandateDraft,
  RequestSnapshot,
  TransactionReporter,
} from './types';

export interface LiveBackendDependencies {
  config: PublicConfig;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  ownerAddress: () => Address | null;
  ownerProvider: () => Promise<OwnerProvider>;
}

const ZERO = '0x0000000000000000000000000000000000000000';

export function createLiveBackend(dependencies: LiveBackendDependencies): GolBackend {
  const { config, authedFetch, ownerAddress, ownerProvider } = dependencies;

  async function unlinkedSnapshot(owner: Address): Promise<AccountSnapshot> {
    // Completed owner steps are derived from the chain, never from browser storage.
    const factory = config.factoryAddress;
    const account = factory
      ? await publicClientFor(config).readContract({
          address: factory,
          abi: golAccountFactoryAbi,
          functionName: 'accounts',
          args: [owner],
        })
      : ZERO;
    const accountAddress = account !== ZERO ? (account as Address) : null;
    const [ownerGas, accountUsdc, activeMandateId] = await Promise.all([
      readNativeGas(config, owner),
      accountAddress ? readAccountUsdc(config, accountAddress) : Promise.resolve(0n),
      accountAddress
        ? publicClientFor(config).readContract({
            address: accountAddress,
            abi: golAccountAbi,
            functionName: 'activeMandateId',
          })
        : Promise.resolve(0n),
    ]);
    return {
      ownerAddress: owner,
      accountAddress,
      agentAddress: null,
      linked: false,
      policyId: null,
      policyDisclosure: null,
      recipients: [],
      balances: {
        accountUsdcUnits: accountUsdc.toString(),
        ownerGasWei: ownerGas.toString(),
        agentGasWei: '0',
      },
      activeMandateId: activeMandateId.toString(),
      mandate: null,
    };
  }

  return {
    async loadAccount() {
      const owner = ownerAddress();
      if (!owner) return null;
      const value = await authedFetch('/api/account');
      if (value.state !== 'ready') return unlinkedSnapshot(owner);
      const balances = value.balances as Record<string, string>;
      return {
        ownerAddress: addressSchema.parse(value.ownerAddress),
        accountAddress: addressSchema.parse(value.accountAddress),
        agentAddress: addressSchema.parse(value.agentAddress),
        linked: true,
        policyId: String((value.agentControl as Record<string, unknown>)?.policyId ?? ''),
        policyDisclosure:
          ((value.agentControl as Record<string, unknown>)
            ?.disclosure as AccountSnapshot['policyDisclosure']) ?? null,
        recipients: (value.recipients as AccountSnapshot['recipients']) ?? [],
        balances: {
          accountUsdcUnits: balances?.accountUsdcUnits ?? '0',
          ownerGasWei: balances?.ownerGasWei ?? '0',
          agentGasWei: balances?.agentGasWei ?? '0',
        },
        activeMandateId: String(value.activeMandateId ?? '0'),
        mandate: (value.mandate as AccountSnapshot['mandate']) ?? null,
      } satisfies AccountSnapshot;
    },

    async ownerGasWei() {
      const owner = ownerAddress();
      if (!owner) return '0';
      return (await readNativeGas(config, owner)).toString();
    },

    async createAccount(report: TransactionReporter) {
      if (!config.factoryAddress) throw new Error('FACTORY_ADDRESS is not configured.');
      await createAccount(await ownerProvider(), config, config.factoryAddress, report);
    },

    async provisionAgent(account: Address, owner: Address, recipient: Address, label: string) {
      await authedFetch('/api/agent/setup', {
        method: 'POST',
        body: JSON.stringify({
          account,
          ownerAddress: owner,
          recipient,
          recipientLabel: label,
          consent: true,
        }),
      });
    },

    async fundAgentGas(agent: Address, units: bigint, report: TransactionReporter) {
      await transferUsdc(await ownerProvider(), config, agent, units, report);
    },

    async fundAccount(account: Address, units: bigint, report: TransactionReporter) {
      await transferUsdc(await ownerProvider(), config, account, units, report);
    },

    async signMandate(account: Address, draft: MandateDraft, report: TransactionReporter) {
      await createMandate(
        await ownerProvider(),
        config,
        account,
        {
          agent: draft.agent,
          perPaymentCap: BigInt(draft.perPaymentCapUnits),
          cumulativeCap: BigInt(draft.cumulativeCapUnits),
          expiresAt: BigInt(draft.expiresAt),
          recipients: [draft.recipient],
        },
        report,
      );
    },

    async revokeMandate(account: Address, mandateId: string, report: TransactionReporter) {
      await revokeMandate(await ownerProvider(), config, account, BigInt(mandateId), report);
    },

    async withdraw(account: Address, units: bigint, report: TransactionReporter) {
      await withdraw(await ownerProvider(), config, account, units, report);
    },

    async submitInstruction(account: Address, requestId: string, text: string, mandateId: string) {
      await authedFetch('/api/instructions', {
        method: 'POST',
        body: JSON.stringify({ account, mandateId, requestId, text }),
      });
    },

    async getRequest(requestId: string): Promise<RequestSnapshot> {
      const value = await authedFetch(`/api/requests/${requestId}`);
      return value as unknown as RequestSnapshot;
    },

    async getActivity(account: Address): Promise<ActivityPage> {
      const value = await authedFetch(
        `/api/activity?account=${account}&first=${ACTIVITY_PAGE_MAX}`,
      );
      return value as unknown as ActivityPage;
    },

    async ask(account: Address, question: string): Promise<GroundedAnswer> {
      const value = await authedFetch('/api/questions', {
        method: 'POST',
        body: JSON.stringify({ account, question }),
      });
      return value as unknown as GroundedAnswer;
    },
  };
}
