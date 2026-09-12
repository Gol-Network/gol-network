import type { PublicConfig } from '@/config';
import type { AccountSnapshot, OwnerActionKind } from '@/client/types';

export type StepId =
  | 'authenticated'
  | 'owner_gas'
  | 'account'
  | 'agent_wallet'
  | 'agent_gas'
  | 'account_funded'
  | 'mandate';

export type StepStatus = 'complete' | 'current' | 'blocked' | 'todo';

export interface SetupStep {
  id: StepId;
  title: string;
  detail: string;
  status: StepStatus;
  /** The owner action this step needs, when the step itself submits a transaction or request. */
  action: OwnerActionKind | null;
  actionLabel: string | null;
}

/**
 * Every completed owner step is derived from the chain and the authenticated account link. No
 * completion is remembered locally, so a reload resumes at the first incomplete step.
 */
export function deriveSteps(input: {
  config: PublicConfig;
  authenticated: boolean;
  account: AccountSnapshot | null;
}): SetupStep[] {
  const { config, authenticated, account } = input;
  const balances = account?.balances;
  const ownerGasReady =
    Boolean(balances) && BigInt(balances!.ownerGasWei) >= BigInt(config.minOwnerGasWei);
  const accountReady = Boolean(account?.accountAddress);
  // An address alone is not enough: an older signer can still be stored while its policy requires
  // migration. The API marks only the current, verified policy revision as linked.
  const recipient = account?.recipients[0] ?? null;
  const recipientReady = Boolean(account?.recipients.length === 1 && recipient?.confirmed);
  const agentReady = Boolean(account?.linked && account.agentAddress && recipientReady);
  const agentGasReady =
    Boolean(balances) && BigInt(balances!.agentGasWei) >= BigInt(config.minAgentGasWei);
  // A positive payment balance is enough to finish setup. The mandate limit is an authority cap,
  // not a requirement to lock the full amount in advance.
  const accountFunded =
    Boolean(balances) &&
    BigInt(balances!.accountUsdcUnits) + BigInt(account?.mandate?.spentUnits ?? '0') > 0n;
  const mandateReady =
    Boolean(account?.agentAddress) &&
    account!.activeMandateId !== '0' &&
    account!.mandate?.revoked === false &&
    account!.mandate.agent.toLowerCase() === account!.agentAddress!.toLowerCase() &&
    recipient?.allowedByActiveMandate === true;

  const definitions: Array<{
    id: StepId;
    title: string;
    detail: string;
    complete: boolean;
    blocked?: boolean;
    action: OwnerActionKind | null;
    actionLabel: string | null;
  }> = [
    {
      id: 'authenticated',
      title: 'Wallet connected',
      detail: authenticated
        ? 'This is your personal wallet. You approve every account change here.'
        : 'Connect the wallet you want to use with GOL.',
      complete: authenticated,
      action: null,
      actionLabel: null,
    },
    {
      id: 'owner_gas',
      title: 'Add Arc network fees',
      detail: ownerGasReady
        ? 'Your wallet is ready to use Arc testnet.'
        : 'Get test USDC from the Arc faucet, then check your balance again.',
      complete: ownerGasReady,
      blocked: authenticated && !ownerGasReady,
      action: null,
      actionLabel: null,
    },
    {
      id: 'account',
      title: 'Create a payment account',
      detail: accountReady
        ? 'Your separate payment balance is ready.'
        : 'This keeps payment funds separate from your personal wallet.',
      complete: accountReady,
      action: 'create_account',
      actionLabel: 'Create payment account',
    },
    config.agentSignerProvider === 'aws_kms'
      ? {
          id: 'agent_wallet',
          title: 'Choose who GOL can pay',
          detail: agentReady
            ? 'GOL is connected to the recipient you approved.'
            : 'Enter and approve one exact recipient for agent payments.',
          complete: agentReady,
          action: 'provision_agent',
          actionLabel: 'Choose recipient',
        }
      : {
          id: 'agent_wallet',
          title: 'Choose who GOL can pay',
          detail: agentReady
            ? 'The payment agent is ready.'
            : 'Enter and approve one exact recipient for agent payments.',
          complete: agentReady,
          action: 'provision_agent',
          actionLabel: 'Choose recipient',
        },
    config.agentGasManaged
      ? {
          id: 'agent_gas',
          title: 'Add agent network fees',
          detail: agentGasReady
            ? 'GOL can now submit payments on Arc.'
            : 'The agent needs test USDC for Arc transaction fees.',
          complete: agentGasReady,
          blocked: agentReady && !agentGasReady,
          action: null,
          actionLabel: null,
        }
      : {
          id: 'agent_gas',
          title: 'Add agent network fees',
          detail: agentGasReady
            ? 'GOL can now submit payments on Arc.'
            : 'Add 1 test USDC for Arc transaction fees. It cannot be used for payments.',
          complete: agentGasReady,
          action: 'fund_agent_gas',
          actionLabel: 'Add 1 USDC fee reserve',
        },
    {
      id: 'account_funded',
      title: 'Set your payment budget',
      detail: accountFunded
        ? 'GOL has USDC available for approved payments.'
        : 'Choose the funds and 7-day limits once. Your wallet will ask for two approvals.',
      complete: accountFunded,
      action: 'fund_account',
      actionLabel: 'Set payment budget',
    },
    {
      id: 'mandate',
      title: 'Set payment rules',
      detail: mandateReady
        ? 'GOL can now pay within the rules you approved.'
        : 'Choose the maximum for one payment and the total allowed for 7 days.',
      complete: mandateReady,
      action: 'sign_mandate',
      actionLabel: 'Set payment rules',
    },
  ];

  let currentAssigned = false;
  return definitions.map((definition) => {
    let status: StepStatus;
    if (definition.complete) {
      status = 'complete';
    } else if (definition.blocked) {
      status = 'blocked';
      currentAssigned = true;
    } else if (!currentAssigned) {
      status = 'current';
      currentAssigned = true;
    } else {
      status = 'todo';
    }
    return {
      id: definition.id,
      title: definition.title,
      detail: definition.detail,
      status,
      action: definition.action,
      actionLabel: definition.actionLabel,
    };
  });
}

export function nextIncompleteStep(steps: SetupStep[]): SetupStep | null {
  return steps.find((step) => step.status === 'current' || step.status === 'blocked') ?? null;
}
