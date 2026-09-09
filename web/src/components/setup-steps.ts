import type { PublicConfig } from '@/config';
import type { AccountSnapshot, OwnerActionKind } from '@/client/types';

export type StepId =
  'authenticated' | 'owner_gas' | 'account' | 'agent_wallet' | 'agent_gas' | 'mandate';

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
  const agentReady = Boolean(account?.agentAddress);
  // When the operator funds the shared agent gas reserve, the owner is never shown this step.
  const agentGasReady =
    config.agentGasManaged ||
    (Boolean(balances) && BigInt(balances!.agentGasWei) >= BigInt(config.minAgentGasWei));
  const mandateReady =
    Boolean(account) && account!.activeMandateId !== '0' && account!.mandate?.revoked === false;

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
      title: 'Owner signed in on Arc testnet',
      detail: authenticated
        ? 'The owner wallet is connected and every owner action is signed by it.'
        : 'Sign in to connect the owner wallet.',
      complete: authenticated,
      action: null,
      actionLabel: null,
    },
    {
      id: 'owner_gas',
      title: 'Owner gas available',
      detail: ownerGasReady
        ? 'The owner wallet holds enough native Arc gas to sign.'
        : 'GOL cannot fund an empty owner wallet. Use the Arc faucet before signing anything.',
      complete: ownerGasReady,
      blocked: authenticated && !ownerGasReady,
      action: null,
      actionLabel: null,
    },
    {
      id: 'account',
      title: 'GOL account created and confirmed',
      detail: accountReady
        ? 'The factory recorded an account for this owner.'
        : 'Create the account contract that will hold the payment balance.',
      complete: accountReady,
      action: 'create_account',
      actionLabel: 'Create GOL account',
    },
    config.agentSignerProvider === 'aws_kms'
      ? {
          id: 'agent_wallet',
          title: 'AWS KMS-backed agent address linked',
          detail: agentReady
            ? 'The non-exportable KMS agent address is linked to this account.'
            : 'Review the restricted agent signer, then link the KMS-backed agent address.',
          complete: agentReady,
          action: 'provision_agent',
          actionLabel: 'Review and link KMS agent',
        }
      : {
          id: 'agent_wallet',
          title: 'Restricted agent wallet provisioned',
          detail: agentReady
            ? 'A separate agent wallet exists with a default-deny signer policy.'
            : 'Review the signer policy, then provision the separate agent wallet.',
          complete: agentReady,
          action: 'provision_agent',
          actionLabel: 'Review and provision agent wallet',
        },
    ...(config.agentGasManaged
      ? []
      : [
          {
            id: 'agent_gas' as StepId,
            title: 'Agent gas reserve funded and confirmed',
            detail: agentGasReady
              ? 'The agent wallet can pay gas for its own transactions.'
              : 'Top up the agent gas reserve. This transfer sits outside the mandate budget.',
            complete: agentGasReady,
            action: 'fund_agent_gas' as OwnerActionKind,
            actionLabel: 'Top up agent gas',
          },
        ]),
    {
      id: 'mandate',
      title: 'Mandate reviewed, signed, and confirmed',
      detail: mandateReady
        ? 'The active mandate authorises the agent within its caps.'
        : 'Review the exact mandate values before signing.',
      complete: mandateReady,
      action: 'sign_mandate',
      actionLabel: 'Review mandate',
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
