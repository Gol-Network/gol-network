'use client';

import { useExportWallet, usePrivy, useWallets } from '@privy-io/react-auth';
import {
  addressSchema,
  formatUsdc,
  type ActivityPage,
  type Address,
  type GroundedAnswer,
} from '@gol/protocol';
import { getAddress } from 'viem';
import { parseInstruction } from '@gol/agent/instruction';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { PublicConfig } from '@/config';
import { createFixtureBackend } from '@/client/fixture-backend';
import { createLiveBackend } from '@/client/live-backend';
import { isTerminalStage, stageFromJournal } from '@/client/stages';
import { INDEXING_BACKOFF_MS, isIndexed, type PendingActivity } from '@/client/timeline';
import type {
  AccountSnapshot,
  AuthState,
  GolBackend,
  InstructionPreview,
  MandateDraft,
  OwnerActionKind,
  PaymentStage,
  TransactionState,
} from '@/client/types';
import { Dashboard, type DashboardProps, type TransferReview } from './Dashboard';
import { deriveSteps } from './setup-steps';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export function GolApp({ config }: { config: PublicConfig }) {
  return config.mode === 'live' ? (
    <LiveGolApp config={config} />
  ) : (
    <FixtureGolApp config={config} />
  );
}

function LiveGolApp({ config }: { config: PublicConfig }) {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { exportWallet } = useExportWallet();
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const preferredRef = useRef<string | undefined>(undefined);
  preferredRef.current = user?.wallet?.address;

  const authedFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getAccessToken();
      if (!token) throw new Error('AUTH_REQUIRED');
      const response = await fetch(path, {
        ...init,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          ...init.headers,
        },
      });
      const value = (await response.json()) as Record<string, unknown>;
      if (!response.ok) throw new Error(String(value.error ?? `HTTP_${response.status}`));
      return value;
    },
    [getAccessToken],
  );

  const backend = useMemo(
    () =>
      createLiveBackend({
        config,
        authedFetch,
        ownerAddress: () => {
          const preferred = preferredRef.current?.toLowerCase();
          const wallet =
            walletsRef.current.find((entry) => entry.address.toLowerCase() === preferred) ??
            walletsRef.current[0];
          return wallet ? (wallet.address as Address) : null;
        },
        ownerProvider: async () => {
          const preferred = preferredRef.current?.toLowerCase();
          const wallet =
            walletsRef.current.find((entry) => entry.address.toLowerCase() === preferred) ??
            walletsRef.current[0];
          if (!wallet) throw new Error('An owner wallet is required.');
          return wallet.getEthereumProvider();
        },
      }),
    [config, authedFetch],
  );

  const auth: AuthState = {
    ready,
    authenticated,
    label: authenticated ? 'Signed in' : 'Sign in with Privy',
    login,
    logout,
    exportWallet: async (address) => exportWallet({ address }),
  };
  return (
    <GolExperience
      config={config}
      auth={auth}
      backend={backend}
      enabled={ready && authenticated && wallets.length > 0}
    />
  );
}

function FixtureGolApp({ config }: { config: PublicConfig }) {
  const backendRef = useRef<GolBackend | null>(null);
  if (backendRef.current === null) backendRef.current = createFixtureBackend(config);
  const [started, setStarted] = useState(false);
  const auth: AuthState = {
    ready: true,
    authenticated: started,
    label: started ? 'Fixture owner' : 'Start fixture walkthrough',
    login: () => setStarted(true),
    logout: () => setStarted(false),
    exportWallet: async () => undefined,
  };
  return (
    <GolExperience config={config} auth={auth} backend={backendRef.current} enabled={started} />
  );
}

interface PaymentView {
  stage: PaymentStage;
  requestId: string | null;
  txHash: string | null;
  explorerUrl: string | null;
  rule: string | null;
  attemptedUnits: string | null;
  headroomUnits: string | null;
  detail: string;
  warning: string | null;
}

const UNAVAILABLE_PAGE: ActivityPage = {
  records: [],
  cursor: null,
  indexedBlock: null,
  indexedBlockHash: null,
  indexedAt: null,
  chainHeadBlock: null,
  hasIndexingErrors: null,
  freshness: 'unavailable',
  sourceDeployment: null,
  partial: false,
};

const IDLE_PAYMENT: PaymentView = {
  stage: 'idle',
  requestId: null,
  txHash: null,
  explorerUrl: null,
  rule: null,
  attemptedUnits: null,
  headroomUnits: null,
  detail: '',
  warning: null,
};

function GolExperience({
  config,
  auth,
  backend,
  enabled,
}: {
  config: PublicConfig;
  auth: AuthState;
  backend: GolBackend;
  enabled: boolean;
}) {
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [tx, setTx] = useState<TransactionState>({
    kind: null,
    phase: 'idle',
    hash: null,
    detail: '',
  });
  const [busy, setBusy] = useState<OwnerActionKind | null>(null);
  const [recipientInput, setRecipientInput] = useState('');
  const [consentOpen, setConsentOpen] = useState(false);
  const [transferReview, setTransferReview] = useState<TransferReview | null>(null);
  const [mandateReview, setMandateReview] = useState<MandateDraft | null>(null);

  const [instruction, setInstruction] = useState(`Pay 40 USDC to ${config.recipientLabel}`);
  const [preview, setPreview] = useState<InstructionPreview | null>(null);
  const [payment, setPayment] = useState<PaymentView>(IDLE_PAYMENT);

  const [page, setPage] = useState<ActivityPage | null>(null);
  const [lastGoodPage, setLastGoodPage] = useState<ActivityPage | null>(null);
  const [pending, setPending] = useState<PendingActivity[]>([]);
  const [indexingWindowClosed, setIndexingWindowClosed] = useState(false);
  const [checkingIndexing, setCheckingIndexing] = useState(false);

  const [question, setQuestion] = useState('Why was the 70 USDC payment refused?');
  const [answer, setAnswer] = useState<GroundedAnswer | null>(null);
  const [asking, setAsking] = useState(false);

  const accountRef = useRef<AccountSnapshot | null>(null);
  accountRef.current = account;

  const refreshAccount = useCallback(async () => {
    if (!enabled) {
      setAccount(null);
      return null;
    }
    try {
      const snapshot = await backend.loadAccount();
      setAccount(snapshot);
      setAccountError(null);
      return snapshot;
    } catch (error) {
      setAccountError(message(error));
      return accountRef.current;
    }
  }, [backend, enabled]);

  const refreshActivity = useCallback(
    async (address?: Address | null) => {
      const target = address ?? accountRef.current?.accountAddress ?? null;
      if (!target) return null;
      try {
        const next = await backend.getActivity(target);
        setPage(next);
        if (next.freshness !== 'unavailable') setLastGoodPage(next);
        setPending((current) => {
          const remaining = current.filter((entry) => !isIndexed(next, entry));
          // Keep the same array identity when nothing was indexed, so the bounded polling
          // window is not restarted by its own refresh.
          return remaining.length === current.length ? current : remaining;
        });
        return next;
      } catch {
        // A Graph failure never removes a confirmed on-chain result.
        setPage(UNAVAILABLE_PAGE);
        return null;
      }
    },
    [backend],
  );

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);

  const accountAddress = account?.accountAddress ?? null;
  useEffect(() => {
    void refreshActivity(accountAddress);
  }, [refreshActivity, accountAddress]);

  // Bounded automatic indexing window. The overlay is retained after it closes.
  useEffect(() => {
    if (pending.length === 0 || !accountAddress) return;
    let cancelled = false;
    setIndexingWindowClosed(false);
    (async () => {
      for (const delay of INDEXING_BACKOFF_MS) {
        await pause(delay);
        if (cancelled) return;
        const next = await refreshActivity(accountAddress);
        if (!next) continue;
        if (pending.every((entry) => isIndexed(next, entry))) return;
      }
      if (!cancelled) setIndexingWindowClosed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, accountAddress, refreshActivity]);

  const pollRequest = useCallback(
    async (requestId: string) => {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        let snapshot;
        try {
          snapshot = await backend.getRequest(requestId);
        } catch (error) {
          // Keep the last confirmed view. A failed poll is not a payment outcome.
          setPayment((current) => ({ ...current, warning: message(error) }));
          await pause(2_000);
          continue;
        }
        const stage = stageFromJournal(snapshot.state);
        setPayment({
          stage,
          requestId,
          txHash: snapshot.txHash,
          explorerUrl: snapshot.explorerUrl,
          rule: snapshot.rule,
          attemptedUnits: snapshot.attemptedUnits,
          headroomUnits: snapshot.headroomUnits,
          detail: snapshot.errorCode ?? '',
          warning: null,
        });
        if (isTerminalStage(stage)) {
          const linked = accountRef.current?.accountAddress;
          if (linked) window.localStorage.removeItem(pendingRequestKey(linked));
          if ((stage === 'executed' || stage === 'refused') && snapshot.txHash) {
            const overlay: PendingActivity = {
              requestId,
              txHash: snapshot.txHash,
              outcome: stage === 'executed' ? 'EXECUTED' : 'REFUSED',
              rule: snapshot.rule ?? (stage === 'executed' ? 'NONE' : 'CUMULATIVE_CAP'),
              mandateId: snapshot.mandateId,
              recipient: snapshot.recipient ?? '',
              attempted: snapshot.attemptedUnits ?? '0',
              transferred: stage === 'executed' ? (snapshot.attemptedUnits ?? '0') : '0',
              headroom: snapshot.headroomUnits ?? '0',
              spentAfter: '0',
              confirmedAt: Date.now(),
            };
            setPending((current) =>
              current.some((entry) => entry.requestId === overlay.requestId)
                ? current
                : [overlay, ...current],
            );
          }
          const refreshed = await refreshAccount();
          await refreshActivity(refreshed?.accountAddress ?? accountRef.current?.accountAddress);
          return;
        }
        await pause(2_000);
      }
      setPayment((current) => ({
        ...current,
        warning: 'Still pending. This request recovers after a refresh.',
      }));
    },
    [backend, refreshAccount, refreshActivity],
  );

  // Recover a non-terminal request after a reload.
  const recoveredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !accountAddress) return;
    const stored = window.localStorage.getItem(pendingRequestKey(accountAddress));
    if (!stored || recoveredRef.current === stored) return;
    recoveredRef.current = stored;
    setPayment({ ...IDLE_PAYMENT, stage: 'queued', requestId: stored });
    void pollRequest(stored);
  }, [enabled, accountAddress, pollRequest]);

  const report = useCallback(
    (kind: OwnerActionKind) =>
      (update: { phase: TransactionState['phase']; hash?: string | null; detail?: string }) => {
        setTx((current) => ({
          kind,
          phase: update.phase,
          hash: update.hash ?? (update.phase === 'awaiting_signature' ? null : current.hash),
          detail: update.detail ?? '',
        }));
      },
    [],
  );

  const runOwnerAction = useCallback(
    async (kind: OwnerActionKind, work: (reporter: ReturnType<typeof report>) => Promise<void>) => {
      if (busy) return;
      setBusy(kind);
      setTx({ kind, phase: 'awaiting_signature', hash: null, detail: '' });
      try {
        await work(report(kind));
      } catch (error) {
        setTx((current) => ({
          kind,
          phase: current.phase === 'awaiting_signature' ? 'failed' : current.phase,
          hash: current.hash,
          detail: message(error),
        }));
      } finally {
        setBusy(null);
        await refreshAccount();
      }
    },
    [busy, report, refreshAccount],
  );

  const steps = useMemo(
    () => deriveSteps({ config, authenticated: auth.authenticated && enabled, account }),
    [config, auth.authenticated, enabled, account],
  );

  async function onCreateAccount() {
    await runOwnerAction('create_account', async (reporter) => backend.createAccount(reporter));
  }

  async function onProvisionAgent() {
    const parsed = addressSchema.safeParse(normalizeAddress(recipientInput));
    const current = accountRef.current;
    if (!parsed.success || !current?.accountAddress) {
      setTx({
        kind: 'provision_agent',
        phase: 'failed',
        hash: null,
        detail: 'Enter the approved recipient address before provisioning the agent wallet.',
      });
      return;
    }
    setConsentOpen(false);
    await runOwnerAction('provision_agent', async () => {
      await backend.provisionAgent(
        current.accountAddress!,
        current.ownerAddress,
        parsed.data,
        config.recipientLabel,
      );
    });
  }

  function onReviewAgentGas() {
    const current = accountRef.current;
    if (!current?.agentAddress) return;
    setTransferReview({
      kind: 'fund_agent_gas',
      title: 'Top up the agent gas reserve',
      destination: current.agentAddress,
      destinationLabel: 'Agent wallet',
      amountUnits: config.agentGasTopUpUnits,
      note: 'This transfer is outside the mandate’s account budget. It only lets the agent wallet pay its own gas.',
    });
  }

  function onReviewAccountFunding(amountUnits: string) {
    const current = accountRef.current;
    if (!current?.accountAddress) return;
    setTransferReview({
      kind: 'fund_account',
      title: 'Deposit to the GOL account',
      destination: current.accountAddress,
      destinationLabel: 'GOL account',
      amountUnits,
      note: 'This amount will be transferred from the owner wallet to the GOL account.',
    });
  }

  function onReviewWithdraw(amountUnits: string) {
    const current = accountRef.current;
    if (!current?.accountAddress) return;
    setTransferReview({
      kind: 'withdraw',
      title: 'Withdraw from the GOL account',
      destination: current.ownerAddress,
      destinationLabel: 'Owner wallet',
      amountUnits,
      note: 'The GOL account contract sends this amount only to its immutable owner wallet.',
    });
  }

  async function onConfirmTransfer() {
    const current = accountRef.current;
    const review = transferReview;
    if (!current || !review) return;
    setTransferReview(null);
    const units = BigInt(review.amountUnits);
    await runOwnerAction(review.kind, async (reporter) => {
      if (review.kind === 'fund_agent_gas') {
        return backend.fundAgentGas(review.destination as Address, units, reporter);
      }
      if (review.kind === 'withdraw') {
        return backend.withdraw(current.accountAddress!, units, reporter);
      }
      return backend.fundAccount(review.destination as Address, units, reporter);
    });
  }

  function onReviewMandate() {
    const current = accountRef.current;
    const recipient = current?.recipients[0];
    if (!current?.agentAddress || !recipient) return;
    setMandateReview({
      agent: current.agentAddress,
      recipient: recipient.address,
      recipientLabel: recipient.label,
      perPaymentCapUnits: config.accountTargetUnits,
      cumulativeCapUnits: config.accountTargetUnits,
      expiresAt: String(Math.floor(Date.now() / 1_000) + SEVEN_DAYS_SECONDS),
    });
  }

  async function onSignMandate() {
    const current = accountRef.current;
    const draft = mandateReview;
    if (!current?.accountAddress || !draft) return;
    setMandateReview(null);
    await runOwnerAction('sign_mandate', async (reporter) =>
      backend.signMandate(current.accountAddress!, draft, reporter),
    );
  }

  async function onRevoke() {
    const current = accountRef.current;
    if (!current?.accountAddress || current.activeMandateId === '0') return;
    await runOwnerAction('revoke_mandate', async (reporter) =>
      backend.revokeMandate(current.accountAddress!, current.activeMandateId, reporter),
    );
  }

  async function onPreview(event: FormEvent) {
    event.preventDefault();
    const current = accountRef.current;
    if (!current?.accountAddress || current.activeMandateId === '0') {
      setPayment({
        ...IDLE_PAYMENT,
        stage: 'needs_clarification',
        detail: 'Complete the setup checklist before running the agent.',
      });
      return;
    }
    setPayment({ ...IDLE_PAYMENT, stage: 'parsing' });
    const parsed = await parseInstruction(instruction, current.recipients);
    if (parsed.kind === 'clarification') {
      setPreview(null);
      setPayment({ ...IDLE_PAYMENT, stage: 'needs_clarification', detail: parsed.message });
      return;
    }
    const label =
      current.recipients.find(
        (entry) => entry.address.toLowerCase() === parsed.intent.recipient.toLowerCase(),
      )?.label ?? config.recipientLabel;
    setPreview({
      requestId: randomRequestId(),
      amountUsdc: parsed.intent.amountUsdc,
      recipient: parsed.intent.recipient,
      recipientLabel: label,
      mandateId: current.activeMandateId,
    });
    setPayment(IDLE_PAYMENT);
  }

  async function onSubmitInstruction() {
    const current = accountRef.current;
    const resolved = preview;
    if (!current?.accountAddress || !resolved) return;
    setPreview(null);
    setPayment({ ...IDLE_PAYMENT, stage: 'queued', requestId: resolved.requestId });
    try {
      window.localStorage.setItem(pendingRequestKey(current.accountAddress), resolved.requestId);
      await backend.submitInstruction(
        current.accountAddress,
        resolved.requestId,
        instruction,
        resolved.mandateId,
      );
      await pollRequest(resolved.requestId);
    } catch (error) {
      setPayment((currentView) => ({
        ...currentView,
        stage: 'unknown',
        detail: message(error),
      }));
    }
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault();
    const current = accountRef.current;
    if (!current?.accountAddress) return;
    setAsking(true);
    try {
      // Asking never refreshes the timeline away, enqueues work, or reaches the signer.
      setAnswer(await backend.ask(current.accountAddress, question));
    } catch (error) {
      setAnswer({
        status: 'unavailable',
        text: `Indexed evidence unavailable: ${message(error)}`,
        citations: [],
        indexedBlock: null,
        indexedAt: null,
        sourceDeployment: null,
        freshness: 'unavailable',
        recordCount: 0,
        partial: false,
        deterministic: true,
      });
    } finally {
      setAsking(false);
    }
  }

  async function onCheckIndexing() {
    setCheckingIndexing(true);
    try {
      await refreshActivity(accountRef.current?.accountAddress);
    } finally {
      setCheckingIndexing(false);
    }
  }

  const props: DashboardProps = {
    config,
    auth,
    account,
    accountError,
    steps,
    tx,
    busy,
    recipientInput,
    setRecipientInput,
    consentOpen,
    setConsentOpen,
    mandateReview,
    setMandateReview,
    onCreateAccount: () => void onCreateAccount(),
    onProvisionAgent: () => void onProvisionAgent(),
    onReviewAgentGas,
    onReviewAccountFunding,
    onReviewWithdraw,
    transferReview,
    setTransferReview,
    onConfirmTransfer: () => void onConfirmTransfer(),
    onReviewMandate,
    onSignMandate: () => void onSignMandate(),
    onRevoke: () => void onRevoke(),
    instruction,
    setInstruction,
    preview,
    onPreview: (event) => void onPreview(event),
    onSubmitInstruction: () => void onSubmitInstruction(),
    onCancelPreview: () => setPreview(null),
    payment,
    page,
    lastGoodPage,
    pending,
    indexingWindowClosed,
    checkingIndexing,
    onCheckIndexing: () => void onCheckIndexing(),
    question,
    setQuestion,
    onAsk: (event) => void onAsk(event),
    answer,
    asking,
  };
  return <Dashboard {...props} />;
}

export type { PaymentView };

/** Accepts an address in any case and returns its checksummed form for validation. */
function normalizeAddress(value: string): string {
  const trimmed = value.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? getAddress(trimmed) : trimmed;
}

function pendingRequestKey(account: string) {
  return `gol:pending:${account.toLowerCase()}`;
}

function randomRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected failure';
}

function pause(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
