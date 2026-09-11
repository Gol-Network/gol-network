'use client';

import {
  useExportWallet,
  useLinkAccount,
  useLogin,
  usePrivy,
  useWallets,
} from '@privy-io/react-auth';
import {
  addressSchema,
  formatUsdc,
  type ActivityPage,
  type Address,
  type GroundedAnswer,
} from '@gol/protocol';
import { getAddress } from 'viem';
import { parseInstruction } from '@gol/agent/instruction';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicConfig } from '@/config';
import { createFixtureBackend } from '@/client/fixture-backend';
import { createLiveBackend } from '@/client/live-backend';
import { createBotanaryMoneyClient } from '@/client/botanary-money';
import type { PreparedAaveTransaction } from '@/client/aave-transactions';
import { errorCodeCopy, isTerminalStage, stageFromJournal } from '@/client/stages';
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
  return config.privyAppId ? <PrivyGolApp config={config} /> : <FixtureGolApp config={config} />;
}

function PrivyGolApp({ config }: { config: PublicConfig }) {
  const { ready, authenticated, logout, user, getAccessToken } = usePrivy();
  const [authError, setAuthError] = useState<string | null>(null);
  const [walletActionError, setWalletActionError] = useState<string | null>(null);
  const { login } = useLogin({
    onComplete: () => setAuthError(null),
    onError: (error) => {
      if (error === 'exited_auth_flow') {
        setAuthError(null);
        return;
      }
      setAuthError('Privy could not complete sign in. Please try again.');
    },
  });
  const { wallets } = useWallets();
  const { exportWallet } = useExportWallet();
  const { linkWallet } = useLinkAccount({
    onSuccess: () => setWalletActionError(null),
    onError: (error) => {
      if (error === 'exited_link_flow') {
        setWalletActionError(null);
        return;
      }
      setWalletActionError('Privy could not link that wallet. Please try again.');
    },
  });
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const userWalletAddress = user?.wallet?.address.toLowerCase();
  const activeOwnerWallet =
    wallets.find((wallet) => wallet.walletClientType === 'privy') ??
    wallets.find((wallet) => wallet.address.toLowerCase() === userWalletAddress) ??
    wallets[0] ??
    null;
  const ownerAddress = activeOwnerWallet?.address ?? null;
  const preferredRef = useRef<string | undefined>(undefined);
  preferredRef.current = ownerAddress ?? undefined;

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

  const backend = useMemo(() => {
    const ownerProvider = async () => {
      const preferred = preferredRef.current?.toLowerCase();
      const wallet =
        walletsRef.current.find((entry) => entry.address.toLowerCase() === preferred) ??
        walletsRef.current[0];
      if (!wallet) throw new Error('An owner wallet is required.');
      return wallet.getEthereumProvider();
    };
    if (config.mode === 'fixture') {
      const fixture = createFixtureBackend(config);
      const money = createBotanaryMoneyClient({ getAccessToken, ownerProvider });
      return {
        ...fixture,
        listMoneyTokens: money.tokens,
        quoteMoneySwap: money.quote,
        executeMoneySwap: money.swap,
        executeMoneySend: money.send,
        getMoneyReceiveInfo: money.receive,
      };
    }
    return createLiveBackend({
      config,
      authedFetch,
      getAccessToken,
      ownerAddress: () => {
        const preferred = preferredRef.current?.toLowerCase();
        const wallet =
          walletsRef.current.find((entry) => entry.address.toLowerCase() === preferred) ??
          walletsRef.current[0];
        return wallet ? (wallet.address as Address) : null;
      },
      ownerProvider,
    });
  }, [config, authedFetch, getAccessToken]);

  const auth: AuthState = {
    mode: 'live',
    ready,
    authenticated,
    label: authenticated ? 'Signed in with Privy' : 'Sign in with Privy',
    error: authError,
    ownerAddress,
    walletActionError,
    login: (method, prefill) => {
      setAuthError(null);
      login(
        method
          ? {
              loginMethods: [method],
              ...(method === 'email' && prefill
                ? { prefill: { type: 'email' as const, value: prefill } }
                : {}),
            }
          : undefined,
      );
    },
    logout: async () => {
      setAuthError(null);
      setWalletActionError(null);
      await logout();
    },
    wallets: wallets.map((wallet) => ({
      address: wallet.address,
      chainId: wallet.chainId.startsWith('eip155:')
        ? Number(wallet.chainId.slice('eip155:'.length))
        : null,
      name: wallet.meta.name || 'Connected wallet',
      imported: wallet.imported,
      exportable: wallet.walletClientType === 'privy',
    })),
    linkWallet: () => {
      setWalletActionError(null);
      linkWallet();
    },
    exportWallet: async (address) => exportWallet({ address }),
  };
  return (
    <GolExperience
      // Privy can hydrate more than one linked wallet in stages. Reset all account-derived state
      // when the active owner changes so the dashboard, chat context, and signing provider cannot
      // retain a snapshot that belongs to the previously selected wallet.
      key={`${user?.id ?? 'signed-out'}:${ownerAddress?.toLowerCase() ?? 'no-wallet'}`}
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
    mode: 'fixture',
    ready: true,
    authenticated: started,
    label: started ? 'Fixture owner' : 'Start fixture walkthrough',
    error: null,
    login: () => undefined,
    startFixture: () => setStarted(true),
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

  const [instruction, setInstruction] = useState(`Pay 10 USDC to ${config.recipientLabel}`);
  const [preview, setPreview] = useState<InstructionPreview | null>(null);
  const [payment, setPayment] = useState<PaymentView>(IDLE_PAYMENT);

  const [page, setPage] = useState<ActivityPage | null>(null);
  const [lastGoodPage, setLastGoodPage] = useState<ActivityPage | null>(null);
  const [pending, setPending] = useState<PendingActivity[]>([]);
  const [indexingWindowClosed, setIndexingWindowClosed] = useState(false);
  const [checkingIndexing, setCheckingIndexing] = useState(false);

  const [question, setQuestion] = useState('What was this agent refused, and why?');
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

  useEffect(() => {
    if (recipientInput.trim()) return;
    const excluded = new Set(
      [auth.ownerAddress, account?.ownerAddress, account?.accountAddress, account?.agentAddress]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase()),
    );
    const candidates = (auth.wallets ?? []).filter(
      (wallet) => !excluded.has(wallet.address.toLowerCase()),
    );
    const fallbackWallet =
      candidates.find((wallet) => !wallet.exportable) ??
      candidates.find((wallet) => wallet.imported) ??
      null;
    const suggestedAddress =
      auth.ownerAddress ?? account?.ownerAddress ?? fallbackWallet?.address ?? null;
    if (suggestedAddress) {
      setRecipientInput(suggestedAddress);
    }
  }, [account, auth.ownerAddress, auth.wallets, recipientInput]);

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
          detail: errorCodeCopy(snapshot.errorCode),
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
      if (busy) return false;
      const before = accountRef.current;
      let refreshed = false;
      let converged = false;
      setBusy(kind);
      setTx({ kind, phase: 'awaiting_signature', hash: null, detail: '' });
      try {
        await work(report(kind));
        for (const delay of [0, 300, 900, 1_800]) {
          if (delay > 0) await pause(delay);
          const snapshot = await refreshAccount();
          refreshed = true;
          if (ownerActionStateConverged(kind, before, snapshot)) {
            converged = true;
            break;
          }
        }
      } catch (error) {
        setTx((current) => ({
          kind,
          phase: current.phase === 'awaiting_signature' ? 'failed' : current.phase,
          hash: current.hash,
          detail: message(error),
        }));
      } finally {
        setBusy(null);
        if (!refreshed) await refreshAccount();
      }
      return converged;
    },
    [busy, report, refreshAccount],
  );

  const steps = useMemo(
    () => deriveSteps({ config, authenticated: auth.authenticated && enabled, account }),
    [config, auth.authenticated, enabled, account],
  );

  useEffect(() => {
    if (tx.phase !== 'confirmed') return;
    const timeout = window.setTimeout(() => {
      setTx({ kind: null, phase: 'idle', hash: null, detail: '' });
    }, 4_000);
    return () => window.clearTimeout(timeout);
  }, [tx.phase]);

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
        detail: 'Enter the only address this agent is allowed to pay.',
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
      title: 'Add Arc network fees',
      destination: current.agentAddress,
      destinationLabel: 'Agent fee reserve',
      amountUnits: config.agentGasTopUpUnits,
      note: 'This fee reserve cannot be used for payments.',
    });
  }

  function onReviewAccountFunding(amountUnits: string) {
    const current = accountRef.current;
    if (!current?.accountAddress) return;
    setTransferReview({
      kind: 'fund_account',
      title: 'Add payment funds',
      destination: current.accountAddress,
      destinationLabel: 'Payment account',
      amountUnits,
      note: 'Only money added here can be used for agent payments.',
    });
  }

  async function onSetPaymentBudget(
    amountUnits: string,
    perPaymentCapUnits: string,
    cumulativeCapUnits: string,
  ) {
    const current = accountRef.current;
    const recipient = current?.recipients[0];
    if (!current?.accountAddress || !current.agentAddress || !recipient) return;

    const funded = await runOwnerAction('fund_account', async (reporter) =>
      backend.fundAccount(current.accountAddress!, BigInt(amountUnits), (update) =>
        reporter({
          ...update,
          detail: update.detail ?? 'Approval 1 of 2: add payment funds.',
        }),
      ),
    );
    if (!funded) return;

    const draft: MandateDraft = {
      agent: current.agentAddress,
      recipient: recipient.address,
      recipientLabel: recipient.label,
      perPaymentCapUnits,
      cumulativeCapUnits,
      expiresAt: String(Math.floor(Date.now() / 1_000) + SEVEN_DAYS_SECONDS),
    };
    await runOwnerAction('sign_mandate', async (reporter) =>
      backend.signMandate(current.accountAddress!, draft, (update) =>
        reporter({
          ...update,
          detail: update.detail ?? 'Approval 2 of 2: save payment rules.',
        }),
      ),
    );
  }

  function onReviewWithdraw(amountUnits: string) {
    const current = accountRef.current;
    if (!current?.accountAddress) return;
    setTransferReview({
      kind: 'withdraw',
      title: 'Withdraw payment funds',
      destination: current.ownerAddress,
      destinationLabel: 'Your personal wallet',
      amountUnits,
      note: 'Payment funds always return to your wallet.',
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

  async function onExecuteAaveTransaction(transaction: PreparedAaveTransaction) {
    await runOwnerAction('aave_action', async (reporter) =>
      backend.executeAaveTransaction(transaction, reporter),
    );
  }

  async function onPreview(instructionOverride?: string) {
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
    const submittedInstruction = instructionOverride ?? instruction;
    if (instructionOverride) setInstruction(instructionOverride);
    const parsed = await parseInstruction(submittedInstruction, current.recipients);
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

  async function onAsk(questionOverride?: string) {
    const current = accountRef.current;
    if (!current?.accountAddress) return;
    setAsking(true);
    try {
      // Asking never refreshes the timeline away, enqueues work, or reaches the signer.
      const submittedQuestion = questionOverride ?? question;
      if (questionOverride) setQuestion(questionOverride);
      setAnswer(await backend.ask(current.accountAddress, submittedQuestion));
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
    onSetPaymentBudget: (amountUnits, perPaymentCapUnits, cumulativeCapUnits) =>
      void onSetPaymentBudget(amountUnits, perPaymentCapUnits, cumulativeCapUnits),
    onReviewWithdraw,
    transferReview,
    setTransferReview,
    onConfirmTransfer: () => void onConfirmTransfer(),
    onReviewMandate,
    onSignMandate: () => void onSignMandate(),
    onRevoke: () => void onRevoke(),
    onExecuteAaveTransaction: (transaction) => void onExecuteAaveTransaction(transaction),
    onListMoneyTokens: (chainId) => backend.listMoneyTokens(chainId),
    onQuoteMoneySwap: (input) => backend.quoteMoneySwap(input),
    onExecuteMoneySwap: (input, report) => backend.executeMoneySwap(input, report),
    onExecuteMoneySend: (input, report) => backend.executeMoneySend(input, report),
    onGetMoneyReceiveInfo: (chainId, token) => backend.getMoneyReceiveInfo(chainId, token),
    instruction,
    setInstruction,
    preview,
    onPreview: (instructionOverride) => void onPreview(instructionOverride),
    onSubmitInstruction: () => void onSubmitInstruction(),
    onCancelPreview: () => setPreview(null),
    payment,
    page,
    lastGoodPage,
    pending,
    indexingWindowClosed,
    checkingIndexing,
    onCheckIndexing: () => void onCheckIndexing(),
    onRefreshAccount: () => void refreshAccount(),
    question,
    setQuestion,
    onAsk: (questionOverride) => void onAsk(questionOverride),
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

function ownerActionStateConverged(
  kind: OwnerActionKind,
  before: AccountSnapshot | null,
  after: AccountSnapshot | null,
) {
  if (!after) return false;
  if (kind === 'create_account') return after.accountAddress !== before?.accountAddress;
  if (kind === 'provision_agent') return after.linked && Boolean(after.agentAddress);
  if (kind === 'fund_agent_gas') {
    return after.balances.agentGasWei !== before?.balances.agentGasWei;
  }
  if (kind === 'fund_account' || kind === 'withdraw') {
    return after.balances.accountUsdcUnits !== before?.balances.accountUsdcUnits;
  }
  if (kind === 'sign_mandate') {
    return after.activeMandateId !== '0' && after.activeMandateId !== before?.activeMandateId;
  }
  if (kind === 'revoke_mandate') {
    return after.activeMandateId === '0' || after.mandate?.revoked === true;
  }
  return true;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected failure';
}

function pause(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
