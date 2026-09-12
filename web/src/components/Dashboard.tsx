'use client';

import { formatUsdc, parseUsdc, type ActivityPage, type GroundedAnswer } from '@gol/protocol';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  CircleAlert,
  CirclePlus,
  Copy,
  KeyRound,
  LoaderCircle,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  Wallet,
  WalletCards,
} from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { explorerAddressUrl, explorerTxUrl, type PublicConfig } from '@/config';
import { PAYMENT_STAGES, TRANSACTION_PHASES } from '@/client/stages';
import {
  extractPreparedAaveReview,
  type PreparedAaveReview,
  type PreparedAaveTransaction,
} from '@/client/aave-transactions';
import {
  filterTimeline,
  mergeTimeline,
  type PendingActivity,
  type TimelineFilter,
} from '@/client/timeline';
import type {
  AccountSnapshot,
  AuthState,
  InstructionPreview,
  MandateDraft,
  MoneyExecutionResult,
  MoneyReceiveInfo,
  MoneySendInput,
  MoneySwapInput,
  MoneySwapQuote,
  MoneyTokenOption,
  OwnerActionKind,
  TransactionReporter,
  TransactionState,
} from '@/client/types';
import type { PaymentView } from './GolApp';
import { nextIncompleteStep, type SetupStep } from './setup-steps';
import { WalletAccountPill } from './wallet-account-pill';
import { AgentChat } from '@/components/ui/agent-chat';
import { ActionDrawer } from '@/components/ui/action-drawer';
import { AaveLogo } from '@/components/ui/aave-logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DitherBackground } from '@/components/ui/dither-background';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export interface TransferReview {
  kind: 'fund_agent_gas' | 'fund_account' | 'withdraw';
  title: string;
  destination: string;
  destinationLabel: string;
  amountUnits: string;
  note: string;
}

export interface DashboardProps {
  config: PublicConfig;
  auth: AuthState;
  account: AccountSnapshot | null;
  accountLoading: boolean;
  accountError: string | null;
  steps: SetupStep[];
  tx: TransactionState;
  busy: OwnerActionKind | null;
  recipientLabelInput: string;
  setRecipientLabelInput: (value: string) => void;
  recipientInput: string;
  setRecipientInput: (value: string) => void;
  consentOpen: boolean;
  setConsentOpen: (value: boolean) => void;
  mandateReview: MandateDraft | null;
  setMandateReview: (value: MandateDraft | null) => void;
  onCreateAccount: () => void;
  onProvisionAgent: () => void;
  onReviewAgentGas: () => void;
  onReviewAccountFunding: (amountUnits: string) => void;
  onSetPaymentBudget: (
    amountUnits: string,
    perPaymentCapUnits: string,
    cumulativeCapUnits: string,
  ) => void;
  transferReview: TransferReview | null;
  setTransferReview: (value: TransferReview | null) => void;
  onConfirmTransfer: () => void;
  onReviewMandate: () => void;
  onSignMandate: () => void;
  onRevoke: () => void;
  onReviewWithdraw: (amountUnits: string) => void;
  onExecuteAaveTransaction: (transaction: PreparedAaveTransaction) => void;
  onListMoneyTokens: (chainId: number) => Promise<MoneyTokenOption[]>;
  onQuoteMoneySwap: (input: MoneySwapInput) => Promise<MoneySwapQuote>;
  onExecuteMoneySwap: (
    input: MoneySwapInput,
    report: TransactionReporter,
  ) => Promise<MoneyExecutionResult>;
  onExecuteMoneySend: (
    input: MoneySendInput,
    report: TransactionReporter,
  ) => Promise<MoneyExecutionResult>;
  onGetMoneyReceiveInfo: (chainId: number, token: string) => Promise<MoneyReceiveInfo>;
  instruction: string;
  setInstruction: (value: string) => void;
  preview: InstructionPreview | null;
  onPreview: (instruction?: string) => void;
  onSubmitInstruction: () => void;
  onCancelPreview: () => void;
  payment: PaymentView;
  page: ActivityPage | null;
  lastGoodPage: ActivityPage | null;
  pending: PendingActivity[];
  indexingWindowClosed: boolean;
  checkingIndexing: boolean;
  onCheckIndexing: () => void;
  onRefreshAccount: () => void;
  question: string;
  setQuestion: (value: string) => void;
  onAsk: (question?: string) => void;
  answer: GroundedAnswer | null;
  asking: boolean;
}

type ThemeMode = 'dark' | 'light';

export function Dashboard(props: DashboardProps) {
  const { config, account } = props;
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [filter, setFilter] = useState<TimelineFilter>('ALL');
  const [tab, setTab] = useState('accounts');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState(props.instruction);
  const [exportTarget, setExportTarget] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [balanceAction, setBalanceAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [aaveReview, setAaveReview] = useState<PreparedAaveReview | null>(null);
  const [desktopWorkspace, setDesktopWorkspace] = useState(false);

  const mandate = account?.mandate ?? null;
  const capUnits = BigInt(mandate?.cumulativeCapUnits ?? config.accountTargetUnits);
  const spentUnits = BigInt(mandate?.spentUnits ?? '0');
  const boundedSpentUnits = spentUnits > capUnits ? capUnits : spentUnits;
  const remainingUnits = capUnits - boundedSpentUnits;
  const source =
    props.page && props.page.freshness !== 'unavailable' ? props.page : props.lastGoodPage;
  const entries = useMemo(
    () => mergeTimeline(source?.records ?? [], props.pending),
    [source, props.pending],
  );
  const visible = useMemo(() => filterTimeline(entries, filter), [entries, filter]);
  const ownerWallet = props.auth.wallets?.find(
    (wallet) => wallet.address.toLowerCase() === account?.ownerAddress?.toLowerCase(),
  );
  const canExportOwner = Boolean(
    account?.ownerAddress &&
    props.auth.exportWallet &&
    (!props.auth.wallets || ownerWallet?.exportable),
  );

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('gol-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
      return;
    }
    setTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('theme-dark', theme === 'dark');
    root.classList.toggle('theme-light', theme === 'light');
    return () => {
      root.classList.remove('theme-dark', 'theme-light');
    };
  }, [theme]);

  useEffect(() => {
    if (['executed', 'refused'].includes(props.payment.stage)) {
      setTab('activity');
      // A previous filter must not hide the outcome that just completed.
      setFilter('ALL');
    }
  }, [props.payment.stage]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const updateWorkspaceMode = () => setDesktopWorkspace(media.matches);
    updateWorkspaceMode();
    media.addEventListener('change', updateWorkspaceMode);
    return () => media.removeEventListener('change', updateWorkspaceMode);
  }, []);

  const selectTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    window.localStorage.setItem('gol-theme', nextTheme);
  };

  if (!props.auth.ready) {
    return (
      <AccountLoadingGate
        theme={theme}
        onThemeChange={selectTheme}
        ownerAddress={props.auth.ownerAddress ?? null}
      />
    );
  }

  if (!props.auth.authenticated) {
    return (
      <SignInGate config={config} auth={props.auth} theme={theme} onThemeChange={selectTheme} />
    );
  }

  if (props.accountLoading) {
    return (
      <AccountLoadingGate
        theme={theme}
        onThemeChange={selectTheme}
        ownerAddress={props.auth.ownerAddress ?? null}
      />
    );
  }

  const nextSetupStep = nextIncompleteStep(props.steps);
  if (nextSetupStep) {
    return (
      <>
        <SetupGate
          {...props}
          theme={theme}
          onThemeChange={selectTheme}
          nextStep={nextSetupStep}
          onOpenActions={() => setDrawerOpen(true)}
          onExport={(address) => {
            setExportError(null);
            setExportTarget(address);
          }}
          exportTarget={exportTarget}
          exportError={exportError}
          onCloseExport={() => {
            setExportError(null);
            setExportTarget(null);
          }}
          onContinueExport={async () => {
            if (!exportTarget) return;
            setExportError(null);
            try {
              await props.auth.exportWallet?.(exportTarget);
              setExportTarget(null);
            } catch (error) {
              setExportError(error instanceof Error ? error.message : 'Wallet export failed.');
            }
          }}
        />
        <ActionDrawer
          open={drawerOpen}
          recipientLabel={account?.recipients[0]?.label ?? 'Approved recipient'}
          recipientAddress={account?.recipients[0]?.address}
          onClose={() => setDrawerOpen(false)}
          onListTokens={props.onListMoneyTokens}
          onQuote={props.onQuoteMoneySwap}
          onSwap={props.onExecuteMoneySwap}
          onSend={props.onExecuteMoneySend}
          onReceive={props.onGetMoneyReceiveInfo}
        />
      </>
    );
  }

  return (
    <main
      className={`theme-${theme} min-h-screen max-w-none bg-background text-foreground transition-colors xl:h-screen xl:overflow-hidden`}
      id="top"
    >
      <header className="flex h-[68px] items-center justify-between border-b border-border px-4 sm:h-[76px] sm:px-7">
        <div className="flex items-center gap-3">
          <a className="flex items-center gap-2.5 text-sm font-bold tracking-[.16em]" href="#top">
            <img className="size-8 sm:size-9" src="/gol-mark-blue.svg" alt="" />
            <span className="font-mono text-sm tracking-[.18em] sm:text-base sm:tracking-[.22em]">
              GOL
            </span>
          </a>
          {config.mode === 'fixture' && (
            <Badge variant="warning" className="font-mono text-[9px] tracking-wider">
              FIXTURE MODE
            </Badge>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <ThemeIconButton theme={theme} onChange={selectTheme} />
          <WalletAccountPill
            config={config}
            account={account}
            auth={props.auth}
            onExport={(address) => {
              setExportError(null);
              setExportTarget(address);
            }}
          />
        </div>
      </header>

      <div className="min-h-[calc(100vh-68px)] sm:min-h-[calc(100vh-76px)] xl:h-[calc(100vh-76px)] xl:min-h-0">
        <ResizablePanelGroup
          id="dashboard-workspace"
          orientation={desktopWorkspace ? 'horizontal' : 'vertical'}
          disabled={!desktopWorkspace}
          className="min-h-[calc(100vh-68px)] gap-4 px-3 py-3 sm:min-h-[calc(100vh-76px)] sm:px-5 sm:py-4 xl:min-h-0 xl:gap-0"
        >
          <ResizablePanel
            id="account-panel"
            defaultSize={desktopWorkspace ? '70%' : undefined}
            minSize={desktopWorkspace ? '30%' : undefined}
            maxSize={desktopWorkspace ? '70%' : undefined}
            className="@container min-w-0 xl:pr-2"
          >
            <section className="min-w-0 xl:h-full xl:min-h-0">
              <div className="h-full overflow-y-auto px-2 py-4 sm:px-4 sm:py-6">
                <AccountProfileHeader
                  config={config}
                  account={account}
                  mandateActive={Boolean(mandate && !mandate.revoked)}
                  remainingUnits={remainingUnits}
                  onActions={() => setDrawerOpen(true)}
                  onDeposit={() => setBalanceAction('deposit')}
                  onPay={() => {
                    const recipient = account?.recipients[0];
                    if (recipient) setChatDraft(`Pay 10 USDC to ${recipient.label}`);
                  }}
                />

                <Tabs value={tab} onValueChange={setTab} className="mt-7">
                  <div className="flex items-center justify-between border-b border-border">
                    <TabsList className="gap-7">
                      {(
                        [
                          ['accounts', 'Overview'],
                          ['activity', 'Activity'],
                          ['rules', 'Payment rules'],
                        ] as const
                      ).map(([value, label]) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          className="relative pb-3 text-sm font-medium text-muted-foreground transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:scale-x-0 after:bg-primary after:transition-transform data-[state=active]:text-foreground data-[state=active]:after:scale-x-100"
                        >
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <span className="hidden pb-3 text-[11px] text-muted-foreground @min-[620px]:inline">
                      Indexed by The Graph
                    </span>
                  </div>

                  <TabsContent value="activity" className="mt-6">
                    <WorkspaceActivity
                      config={config}
                      source={source}
                      visible={visible}
                      filter={filter}
                      setFilter={setFilter}
                      pendingCount={props.pending.length}
                      indexingWindowClosed={props.indexingWindowClosed}
                      checkingIndexing={props.checkingIndexing}
                      onCheckIndexing={props.onCheckIndexing}
                    />
                  </TabsContent>

                  <TabsContent value="accounts" className="mt-6 space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">How your money works</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        You keep control. GOL can only use the payment funds and rules shown here.
                      </p>
                    </div>
                    <AccountAndMandateControls
                      steps={props.steps}
                      busy={props.busy}
                      config={config}
                      account={account}
                      {...(canExportOwner
                        ? {
                            onExport: () => {
                              setExportError(null);
                              setExportTarget(account!.ownerAddress);
                            },
                          }
                        : {})}
                      onAction={(action) => {
                        if (action === 'create_account') props.onCreateAccount();
                        if (action === 'provision_agent') props.setConsentOpen(true);
                        if (action === 'fund_agent_gas') props.onReviewAgentGas();
                        if (action === 'fund_account') setBalanceAction('deposit');
                        if (action === 'withdraw') setBalanceAction('withdraw');
                        if (action === 'sign_mandate') props.onReviewMandate();
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="rules" className="mt-6">
                    <div className="grid gap-3 @min-[600px]:grid-cols-3">
                      <RuleCard
                        label="One payment max"
                        value={
                          mandate
                            ? formatUsdc(BigInt(mandate.perPaymentCapUnits)) + ' USDC'
                            : 'Not configured'
                        }
                      />
                      <RuleCard
                        label="Total limit"
                        value={
                          mandate
                            ? formatUsdc(BigInt(mandate.cumulativeCapUnits)) + ' USDC'
                            : 'Not configured'
                        }
                      />
                      <RuleCard
                        label="Active until"
                        value={
                          mandate
                            ? new Date(Number(mandate.expiresAt) * 1000).toLocaleDateString()
                            : 'Not configured'
                        }
                      />
                    </div>
                    <Card className="mt-4 bg-muted shadow-none">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">
                              Recipient
                            </span>
                            <h3 className="mt-2 text-base font-semibold">
                              The only wallet GOL can pay
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {account?.recipients[0]?.label ?? 'No recipient configured'}
                            </p>
                            {account?.recipients[0]?.address && (
                              <code className="mt-3 block text-[11px] text-muted-foreground">
                                {shorten(account.recipients[0].address)}
                              </code>
                            )}
                          </div>
                          <ShieldCheck className="text-primary" />
                        </div>
                      </CardContent>
                    </Card>
                    <Button
                      className="mt-5"
                      variant="outline"
                      onClick={props.onRevoke}
                      disabled={!mandate || mandate.revoked || props.busy !== null}
                    >
                      Turn off agent payments
                    </Button>
                  </TabsContent>
                </Tabs>

                {props.consentOpen && (
                  <ConsentPanel
                    config={config}
                    account={account}
                    recipientLabelInput={props.recipientLabelInput}
                    setRecipientLabelInput={props.setRecipientLabelInput}
                    recipientInput={props.recipientInput}
                    setRecipientInput={props.setRecipientInput}
                    onCancel={() => props.setConsentOpen(false)}
                    onConfirm={props.onProvisionAgent}
                    disabled={props.busy !== null}
                  />
                )}
                {props.transferReview && (
                  <TransferReviewPanel
                    review={props.transferReview}
                    onCancel={() => props.setTransferReview(null)}
                    onConfirm={props.onConfirmTransfer}
                    disabled={props.busy !== null}
                  />
                )}
                {balanceAction && account?.accountAddress && (
                  <AmountEntryPanel
                    action={balanceAction}
                    availableUnits={account.balances.accountUsdcUnits}
                    onCancel={() => setBalanceAction(null)}
                    onConfirm={(amountUnits) => {
                      setBalanceAction(null);
                      if (balanceAction === 'deposit') props.onReviewAccountFunding(amountUnits);
                      else props.onReviewWithdraw(amountUnits);
                    }}
                  />
                )}
                {props.mandateReview && (
                  <MandateReviewPanel
                    draft={props.mandateReview}
                    onChange={props.setMandateReview}
                    onCancel={() => props.setMandateReview(null)}
                    onConfirm={props.onSignMandate}
                    disabled={props.busy !== null}
                  />
                )}
                {aaveReview && (
                  <AaveTransactionReview
                    review={aaveReview}
                    onCancel={() => setAaveReview(null)}
                    onConfirm={() => {
                      const transaction = aaveReview.transaction;
                      setAaveReview(null);
                      props.onExecuteAaveTransaction(transaction);
                    }}
                    disabled={props.busy !== null}
                  />
                )}
                <TransactionStatus tx={props.tx} config={config} />
                {exportTarget && (
                  <PrivateKeyWarning
                    onCancel={() => {
                      setExportError(null);
                      setExportTarget(null);
                    }}
                    onContinue={async () => {
                      setExportError(null);
                      try {
                        await props.auth.exportWallet?.(exportTarget);
                        setExportTarget(null);
                      } catch (error) {
                        setExportError(
                          error instanceof Error ? error.message : 'Wallet export failed.',
                        );
                      }
                    }}
                    error={exportError}
                  />
                )}
              </div>
            </section>
          </ResizablePanel>

          <ResizableHandle
            id="dashboard-divider"
            aria-label="Resize account and agent panels"
            className={desktopWorkspace ? '' : 'hidden'}
            disabled={!desktopWorkspace}
            withHandle
          />

          <ResizablePanel
            id="agent-panel"
            defaultSize={desktopWorkspace ? '30%' : undefined}
            minSize={desktopWorkspace ? '30%' : undefined}
            maxSize={desktopWorkspace ? '70%' : undefined}
            className="min-w-0 xl:h-full xl:pl-2"
          >
            <AgentChat
              ownerAddress={account?.ownerAddress}
              recipientLabel={account?.recipients[0]?.label ?? null}
              draft={chatDraft}
              onDraftChange={setChatDraft}
              onMandatePrompt={(prompt) => props.onPreview(prompt)}
              onAskRecord={(question) => props.onAsk(question)}
              onOpenActions={() => setDrawerOpen(true)}
              onAaveReview={(result) => {
                const review = extractPreparedAaveReview(result);
                if (review) setAaveReview(review);
              }}
              onGolToolReview={(tool, arguments_) => {
                setTab(tool === 'check_indexing' ? 'activity' : 'accounts');
                if (tool === 'create_account') props.onCreateAccount();
                if (tool === 'provision_agent') props.setConsentOpen(true);
                if (tool === 'fund_agent_gas') props.onReviewAgentGas();
                if (tool === 'fund_account') setBalanceAction('deposit');
                if (tool === 'withdraw') setBalanceAction('withdraw');
                if (tool === 'sign_mandate') props.onReviewMandate();
                if (tool === 'revoke_mandate') props.onRevoke();
                if (tool === 'check_indexing') props.onCheckIndexing();
                if (tool === 'export_owner_wallet' && canExportOwner) {
                  setExportError(null);
                  setExportTarget(account!.ownerAddress);
                }
                if (tool === 'submit_instruction') {
                  const requested = arguments_.instruction;
                  props.onPreview(typeof requested === 'string' ? requested : chatDraft);
                }
              }}
              mandateReady={canRun(props)}
              preview={props.preview}
              onConfirmPreview={props.onSubmitInstruction}
              onCancelPreview={props.onCancelPreview}
              payment={props.payment}
              answer={props.answer}
              busy={props.asking || props.busy !== null}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <ActionDrawer
        open={drawerOpen}
        recipientLabel={account?.recipients[0]?.label ?? 'Approved recipient'}
        recipientAddress={account?.recipients[0]?.address}
        onClose={() => setDrawerOpen(false)}
        onListTokens={props.onListMoneyTokens}
        onQuote={props.onQuoteMoneySwap}
        onSwap={props.onExecuteMoneySwap}
        onSend={props.onExecuteMoneySend}
        onReceive={props.onGetMoneyReceiveInfo}
      />
    </main>
  );
}

function AccountLoadingGate({
  theme,
  onThemeChange,
  ownerAddress,
}: {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  ownerAddress: string | null;
}) {
  return (
    <main
      className={`theme-${theme} min-h-screen max-w-none bg-background text-foreground transition-colors`}
      aria-busy="true"
    >
      <header className="flex h-[68px] items-center justify-between border-b border-border px-4 sm:px-7">
        <a className="flex items-center gap-2.5 text-sm font-bold tracking-[.16em]" href="#account">
          <img className="size-8" src="/gol-mark-blue.svg" alt="" />
          <span className="font-mono text-sm tracking-[.22em]">GOL</span>
        </a>
        <div className="flex items-center gap-3">
          <ThemeIconButton theme={theme} onChange={onThemeChange} />
          {ownerAddress ? (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {ownerAddress.slice(0, 8)}...{ownerAddress.slice(-4)}
            </Badge>
          ) : null}
        </div>
      </header>
      <section
        id="account"
        className="grid min-h-[calc(100vh-68px)] place-items-center px-4 py-8"
        aria-live="polite"
      >
        <Card className="w-full max-w-sm shadow-panel">
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" />
            <h1 className="mt-4 text-lg font-semibold">Restoring your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Checking your payment account and rules.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function SetupGate(
  props: DashboardProps & {
    theme: ThemeMode;
    onThemeChange: (theme: ThemeMode) => void;
    nextStep: SetupStep;
    onOpenActions: () => void;
    onExport: (address: string) => void;
    exportTarget: string | null;
    exportError: string | null;
    onCloseExport: () => void;
    onContinueExport: () => Promise<void>;
  },
) {
  const loading = props.account === null && props.accountError === null;
  const visibleStage = setupStage(props.nextStep.id);
  const [paymentBudgetOpen, setPaymentBudgetOpen] = useState(false);

  const runNextStep = () => {
    const action = props.nextStep.action;
    if (action === 'create_account') props.onCreateAccount();
    if (action === 'provision_agent') props.setConsentOpen(true);
    if (action === 'fund_agent_gas') props.onReviewAgentGas();
    if (action === 'fund_account') setPaymentBudgetOpen(true);
    if (action === 'sign_mandate') props.onReviewMandate();
  };

  return (
    <main
      className={`theme-${props.theme} min-h-screen max-w-none bg-background text-foreground transition-colors`}
    >
      <header className="flex h-[68px] items-center justify-between border-b border-border px-4 sm:px-7">
        <a className="flex items-center gap-2.5 text-sm font-bold tracking-[.16em]" href="#setup">
          <img className="size-8" src="/gol-mark-blue.svg" alt="" />
          <span className="font-mono text-sm tracking-[.22em]">GOL</span>
        </a>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            aria-label="Actions"
            onClick={props.onOpenActions}
          >
            <CirclePlus className="size-4" />
            <span className="hidden sm:inline">Actions</span>
          </Button>
          <ThemeIconButton theme={props.theme} onChange={props.onThemeChange} />
          <WalletAccountPill
            config={props.config}
            account={props.account}
            auth={props.auth}
            onExport={props.onExport}
          />
        </div>
      </header>

      <section
        id="setup"
        className="grid min-h-[calc(100vh-68px)] place-items-center px-4 py-8 sm:px-6"
      >
        <Card className="w-full max-w-xl shadow-panel">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">
                  Account setup
                </span>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                  Set up agent payments
                </h1>
              </div>
              <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                Step {visibleStage} of 3
              </Badge>
            </div>

            <ol
              className="mt-6 grid grid-cols-3 gap-1.5"
              aria-label={`Setup step ${visibleStage} of 3`}
            >
              {(['Your wallet', 'Payment setup', 'Funds and rules'] as const).map(
                (label, index) => {
                  const stage = index + 1;
                  return (
                    <li key={label} className="min-w-0">
                      <span
                        className={`block h-1.5 rounded-full ${
                          stage < visibleStage
                            ? 'bg-success'
                            : stage === visibleStage
                              ? 'bg-primary'
                              : 'bg-muted'
                        }`}
                      />
                      <span
                        className={`mt-2 block truncate text-[10px] ${
                          stage === visibleStage ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {label}
                      </span>
                    </li>
                  );
                },
              )}
            </ol>

            <div className="mt-7 rounded-card border border-border bg-muted p-5">
              <span className="font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
                {loading ? 'Checking account' : 'Next step'}
              </span>
              <h2 className="mt-2 text-lg font-semibold">
                {loading ? 'Loading your wallet state...' : props.nextStep.title}
              </h2>
              <p className="mt-2 text-sm leading-copy text-muted-foreground">
                {loading
                  ? 'Checking your wallet and payment setup on Arc testnet.'
                  : props.nextStep.detail}
              </p>

              {!loading &&
              props.nextStep.status === 'blocked' &&
              (props.nextStep.id === 'agent_gas'
                ? props.account?.agentAddress
                : props.account?.ownerAddress) ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                      {props.nextStep.id === 'agent_gas' ? 'Agent address' : 'Your wallet address'}
                    </span>
                    <code className="block truncate text-xs">
                      {props.nextStep.id === 'agent_gas'
                        ? props.account?.agentAddress
                        : props.account?.ownerAddress}
                    </code>
                  </div>
                  <CopyAddress
                    value={
                      (props.nextStep.id === 'agent_gas'
                        ? props.account?.agentAddress
                        : props.account?.ownerAddress)!
                    }
                  />
                </div>
              ) : null}

              {!loading && props.nextStep.status === 'blocked' && props.config.faucetUrl ? (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button asChild>
                    <a href={props.config.faucetUrl} target="_blank" rel="noreferrer">
                      Open Circle faucet <ArrowUpRight size={15} />
                    </a>
                  </Button>
                  <Button variant="outline" onClick={props.onRefreshAccount}>
                    Check balance again
                  </Button>
                </div>
              ) : null}

              {!loading && props.nextStep.action && props.nextStep.actionLabel ? (
                <Button
                  className="mt-5 w-full"
                  onClick={runNextStep}
                  disabled={props.busy !== null}
                >
                  {props.busy === props.nextStep.action
                    ? 'Waiting for confirmation...'
                    : props.nextStep.actionLabel}
                  <ArrowUpRight size={15} />
                </Button>
              ) : null}
            </div>

            {props.accountError ? (
              <Alert variant="destructive" className="mt-4">
                <CircleAlert className="size-4" aria-hidden />
                <div>
                  <AlertTitle>Could not load your account</AlertTitle>
                  <AlertDescription>{props.accountError}</AlertDescription>
                </div>
              </Alert>
            ) : null}

            {props.account?.ownerAddress ? (
              <p className="mt-5 text-center font-mono text-[10px] text-muted-foreground">
                Your wallet {shorten(props.account.ownerAddress)}
              </p>
            ) : null}

            <TransactionStatus tx={props.tx} config={props.config} />
          </CardContent>
        </Card>
      </section>

      {props.consentOpen ? (
        <ConsentPanel
          config={props.config}
          account={props.account}
          recipientLabelInput={props.recipientLabelInput}
          setRecipientLabelInput={props.setRecipientLabelInput}
          recipientInput={props.recipientInput}
          setRecipientInput={props.setRecipientInput}
          onCancel={() => props.setConsentOpen(false)}
          onConfirm={props.onProvisionAgent}
          disabled={props.busy !== null}
        />
      ) : null}
      {props.transferReview ? (
        <TransferReviewPanel
          review={props.transferReview}
          onCancel={() => props.setTransferReview(null)}
          onConfirm={props.onConfirmTransfer}
          disabled={props.busy !== null}
        />
      ) : null}
      {paymentBudgetOpen && props.account?.recipients[0] ? (
        <PaymentBudgetPanel
          availableUnits={props.account.balances.ownerUsdcUnits}
          defaultUnits={props.config.accountTargetUnits}
          recipient={props.account.recipients[0]}
          accountAddress={props.account.accountAddress!}
          onCancel={() => setPaymentBudgetOpen(false)}
          onConfirm={(amountUnits, perPaymentCapUnits, cumulativeCapUnits) => {
            setPaymentBudgetOpen(false);
            props.onSetPaymentBudget(amountUnits, perPaymentCapUnits, cumulativeCapUnits);
          }}
        />
      ) : null}
      {props.mandateReview ? (
        <MandateReviewPanel
          draft={props.mandateReview}
          onChange={props.setMandateReview}
          onCancel={() => props.setMandateReview(null)}
          onConfirm={props.onSignMandate}
          disabled={props.busy !== null}
        />
      ) : null}
      {props.exportTarget ? (
        <PrivateKeyWarning
          onCancel={props.onCloseExport}
          onContinue={props.onContinueExport}
          error={props.exportError}
        />
      ) : null}
    </main>
  );
}

function setupStage(id: SetupStep['id']): 1 | 2 | 3 {
  if (id === 'authenticated' || id === 'owner_gas') return 1;
  if (id === 'account' || id === 'agent_wallet' || id === 'agent_gas') return 2;
  return 3;
}

function AccountProfileHeader({
  config,
  account,
  mandateActive,
  remainingUnits,
  onActions,
  onDeposit,
  onPay,
}: {
  config: PublicConfig;
  account: AccountSnapshot | null;
  mandateActive: boolean;
  remainingUnits: bigint;
  onActions: () => void;
  onDeposit: () => void;
  onPay: () => void;
}) {
  const ownerAddress = account?.ownerAddress ?? null;
  const accountBalanceUnits = BigInt(account?.balances.accountUsdcUnits ?? '0');
  const availableUnits =
    accountBalanceUnits < remainingUnits ? accountBalanceUnits : remainingUnits;
  const accountBalance = formatUsdc(accountBalanceUnits);
  const avatarSeed = encodeURIComponent((ownerAddress ?? 'gol-owner').toLowerCase());

  return (
    <div className="flex flex-col gap-6 @min-[720px]:flex-row @min-[720px]:items-center @min-[720px]:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <span className="relative shrink-0">
          <Avatar className="size-16 border border-border">
            <AvatarImage
              src={`https://api.dicebear.com/10.x/critters/svg?seed=${avatarSeed}`}
              alt=""
            />
            <AvatarFallback>
              <Wallet className="size-6" aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          <Badge
            className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-2 border-background bg-primary p-1.5"
            title={config.chainName}
          >
            <img src="/arc-mark.png" alt="" className="size-full object-contain" />
            <span className="sr-only">{config.chainName}</span>
          </Badge>
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {ownerAddress ? shorten(ownerAddress) : 'Personal wallet'}
            </span>
            <Badge variant={mandateActive ? 'default' : 'warning'}>
              {mandateActive ? 'Agent ready' : 'Setup required'}
            </Badge>
          </div>
          <span className="mt-3 block text-xs text-muted-foreground">Ready to pay</span>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            <strong className="text-4xl font-semibold leading-none tracking-tight @min-[520px]:text-5xl">
              {formatUsdc(availableUnits)} USDC
            </strong>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>{accountBalance} USDC in payment funds</span>
            <span>{formatUsdc(remainingUnits)} USDC allowed by your rules</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button className="rounded-full" onClick={onActions}>
          <CirclePlus className="size-4" aria-hidden="true" />
          Actions
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={onDeposit}
          disabled={!account?.accountAddress}
        >
          Add funds
        </Button>
        <Button variant="outline" className="rounded-full" onClick={onPay}>
          Send payment
        </Button>
      </div>
    </div>
  );
}

function RuleCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-muted shadow-none">
      <CardContent className="p-4">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <strong className="mt-5 block text-sm">{value}</strong>
      </CardContent>
    </Card>
  );
}

function WorkspaceActivity(props: {
  config: PublicConfig;
  source: ActivityPage | null;
  visible: ReturnType<typeof mergeTimeline>;
  filter: TimelineFilter;
  setFilter: (filter: TimelineFilter) => void;
  pendingCount: number;
  indexingWindowClosed: boolean;
  checkingIndexing: boolean;
  onCheckIndexing: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">
            The Graph
          </span>
          <h3 className="mt-1 text-lg font-semibold">Indexed activity</h3>
        </div>
        <div className="flex rounded-full bg-muted p-1">
          {(['ALL', 'EXECUTED', 'REFUSED'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant="ghost"
              className={`rounded-full text-[10px] ${props.filter === value ? 'bg-card text-primary shadow-sm' : ''}`}
              onClick={() => props.setFilter(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-y border-border py-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" /> {freshnessLabel(props.source, null)}
        </span>
        <span>
          {props.source?.indexedBlock
            ? 'Indexed through block ' + props.source.indexedBlock
            : 'No indexed block'}
        </span>
      </div>
      {props.pendingCount > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-accent px-4 py-3 text-xs text-accent-foreground">
          <span>{props.pendingCount} on-chain result awaiting indexing.</span>
          {props.indexingWindowClosed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={props.onCheckIndexing}
              disabled={props.checkingIndexing}
            >
              {props.checkingIndexing ? 'Checking...' : 'Check again'}
            </Button>
          )}
        </div>
      )}
      {props.visible.length === 0 && props.pendingCount === 0 ? (
        <div className="grid min-h-[300px] place-items-center text-center">
          <div>
            <div className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
              <WalletCards size={20} />
            </div>
            <strong className="mt-4 block text-sm">No activity loaded</strong>
            <span className="mt-1 block text-xs text-muted-foreground">
              Run an instruction after setup.
            </span>
          </div>
        </div>
      ) : (
        <ol className="mt-3 divide-y divide-border" data-testid="activity-timeline">
          {props.visible.map((entry) => {
            const record = entry.kind === 'indexed' ? entry.record : entry.pending;
            const txHash =
              entry.kind === 'indexed' ? entry.record.transactionHash : entry.pending.txHash;
            const refused = record.outcome === 'REFUSED';
            return (
              <li
                key={entry.key}
                data-pending={entry.kind === 'pending' ? 'true' : 'false'}
                className={`grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 py-5 ${entry.kind === 'pending' ? 'opacity-70' : ''}`}
              >
                <span
                  className={`grid size-10 place-items-center rounded-lg text-sm font-semibold ${refused ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}
                >
                  {refused ? '!' : '✓'}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{formatUsdc(BigInt(record.attempted))} USDC</strong>
                    <span
                      className={`rounded-full border px-2 py-1 text-[9px] font-medium ${refused ? 'border-destructive/30 text-destructive' : 'border-primary/30 text-primary'}`}
                    >
                      {record.outcome}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.kind === 'pending'
                      ? `On-chain; indexing pending. ${refused ? `Successful on-chain refusal: ${record.rule}` : 'Payment released by the account contract.'}`
                      : refused
                        ? `Successful on-chain refusal: ${record.rule}`
                        : `Paid ${shorten(record.recipient)}`}
                  </p>
                  <small className="mt-2 block font-mono text-[9px] text-muted-foreground">
                    Request {shorten(record.requestId)}.{' '}
                    <a
                      className="text-primary hover:underline"
                      href={explorerTxUrl(props.config, txHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      transaction ↗
                    </a>
                  </small>
                </div>
                <div className="text-right">
                  <span className="block font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">
                    Headroom
                  </span>
                  <strong className="mt-1 block text-lg">
                    {formatUsdc(BigInt(record.headroom))}
                  </strong>
                  <small className="text-[9px] text-muted-foreground">USDC</small>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function canRun(props: DashboardProps): boolean {
  if (!props.account?.accountAddress || props.account.activeMandateId === '0') return false;
  const stage = props.payment.stage;
  return PAYMENT_STAGES[stage].terminal;
}

function SignInGate({
  config,
  auth,
  theme,
  onThemeChange,
}: Pick<DashboardProps, 'config' | 'auth'> & {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const [email, setEmail] = useState('');
  const authConfigured = auth.mode === 'live';

  function continueWithEmail(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!value || !auth.ready || !authConfigured) return;
    auth.login('email', value);
  }

  return (
    <main
      className={`theme-${theme} relative grid min-h-screen max-w-none place-items-center overflow-y-auto bg-background px-5 py-20 text-foreground transition-colors sm:px-8`}
    >
      <DitherBackground theme={theme} />

      <div className="absolute right-5 top-5 z-10 sm:right-8 sm:top-8">
        <ThemeSwitch theme={theme} onChange={onThemeChange} compact />
      </div>

      <section className="relative z-10 w-full max-w-lg">
        <Card id="signin" className="w-full bg-card/95 shadow-panel backdrop-blur-sm">
          <CardContent className="px-6 py-8 sm:px-12 sm:py-12">
            <div className="flex flex-col items-center text-center">
              <img className="size-16" src="/gol-mark-blue.svg" alt="GOL" />
              <h1 className="mt-5 text-3xl font-semibold tracking-tight">GOL Network</h1>
              <p className="mt-2 text-sm leading-copy text-muted-foreground">
                Sign in to your owner-controlled account
              </p>
            </div>

            <form className="mt-9 space-y-4" onSubmit={continueWithEmail}>
              <div className="grid gap-2">
                <Label htmlFor="signin-email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={!authConfigured}
                    className="h-14 rounded-full pl-11"
                  />
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                className="h-14 w-full rounded-full"
                disabled={!authConfigured || !auth.ready || !email.trim()}
              >
                <Mail size={17} />
                {auth.ready ? 'Continue with email' : 'Initializing Privy...'}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-13 w-full rounded-full"
                onClick={() => auth.login('google')}
                disabled={!authConfigured || !auth.ready}
              >
                <SiGoogle aria-hidden className="size-4" />
                Continue with Google
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-full"
                  onClick={() => auth.login('passkey')}
                  disabled={!authConfigured || !auth.ready}
                >
                  <KeyRound size={16} /> Passkey
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-full"
                  onClick={() => auth.login('wallet')}
                  disabled={!authConfigured || !auth.ready}
                >
                  <Wallet size={16} /> Wallet
                </Button>
              </div>
            </div>

            {auth.error ? (
              <Alert variant="destructive" className="mt-5">
                <CircleAlert className="size-4" aria-hidden />
                <div>
                  <AlertTitle>Sign in failed</AlertTitle>
                  <AlertDescription>{auth.error}</AlertDescription>
                </div>
              </Alert>
            ) : null}

            {!authConfigured ? (
              <div className="mt-5 space-y-3">
                <Alert>
                  <CircleAlert className="size-4" aria-hidden />
                  <div>
                    <AlertTitle>Authentication is not configured</AlertTitle>
                    <AlertDescription>
                      Add the Privy environment variables and restart the app to use Google,
                      passkey, email, or wallet sign-in.
                    </AlertDescription>
                  </div>
                </Alert>
                <Button
                  type="button"
                  size="lg"
                  className="h-14 w-full rounded-full"
                  onClick={auth.startFixture}
                >
                  Open fixture demo
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function ThemeSwitch({
  theme,
  onChange,
  compact = false,
}: {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
  compact?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
      role="group"
      aria-label="Theme"
    >
      {(['dark', 'light'] as const).map((option) => (
        <Button
          key={option}
          type="button"
          variant="ghost"
          size="sm"
          className={`rounded-full px-3 text-xs font-normal ${compact ? 'min-w-12' : 'min-w-14'} ${theme === option ? 'bg-secondary text-foreground shadow-sm hover:bg-secondary' : 'text-muted-foreground'}`}
          aria-pressed={theme === option}
          onClick={() => onChange(option)}
        >
          {option.charAt(0).toUpperCase() + option.slice(1)}
        </Button>
      ))}
    </div>
  );
}

function ThemeIconButton({
  theme,
  onChange,
}: {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-10 rounded-full bg-card shadow-none"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => onChange(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}

function AccountAndMandateControls(props: {
  steps: SetupStep[];
  busy: OwnerActionKind | null;
  config: PublicConfig;
  account: AccountSnapshot | null;
  onExport?: () => void;
  onAction: (action: OwnerActionKind) => void;
}) {
  const step = (id: SetupStep['id']) => props.steps.find((entry) => entry.id === id)!;
  const ownerGas = step('owner_gas');
  const accountStep = step('account');
  const agentStep = step('agent_wallet');
  // Absent when the operator funds the shared agent gas reserve.
  const agentGas = props.steps.find((entry) => entry.id === 'agent_gas') ?? null;
  const mandateStep = step('mandate');
  const mandate = props.account?.mandate ?? null;
  const currentAgent = props.account?.agentAddress ?? null;
  const agentMismatch = Boolean(
    mandate &&
    !mandate.revoked &&
    currentAgent &&
    mandate.agent &&
    mandate.agent.toLowerCase() !== currentAgent.toLowerCase(),
  );
  const prerequisitesReady =
    ownerGas.status === 'complete' &&
    accountStep.status === 'complete' &&
    agentStep.status === 'complete' &&
    (!agentGas || agentGas.status === 'complete');
  const accountBalance = BigInt(props.account?.balances.accountUsdcUnits ?? '0');
  const ruleRemaining = mandate
    ? BigInt(mandate.cumulativeCapUnits) - BigInt(mandate.spentUnits)
    : 0n;
  const recipient = props.account?.recipients[0] ?? null;

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 @min-[620px]:grid-cols-2">
        <Card className="bg-muted shadow-none">
          <CardContent className="flex h-full flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Your wallet</span>
              <Badge variant={ownerGas.status === 'complete' ? 'default' : 'warning'}>
                {ownerGas.status === 'complete' ? 'Ready' : 'Needs gas'}
              </Badge>
            </div>
            <strong className="mt-3 block text-xl">
              {formatUsdc(BigInt(props.account?.balances.ownerUsdcUnits ?? '0'))} USDC
            </strong>
            <p className="mt-1 text-xs text-muted-foreground">Only you can spend this money.</p>
            {props.account?.ownerAddress ? (
              <div className="mt-auto flex items-center gap-1 pt-5 font-mono text-[10px] text-muted-foreground">
                <code title={props.account.ownerAddress}>
                  {shorten(props.account.ownerAddress)}
                </code>
                <CopyAddress value={props.account.ownerAddress} />
                <Button asChild variant="ghost" size="icon" className="size-6 rounded-full">
                  <a
                    href={explorerAddressUrl(props.config, props.account.ownerAddress)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View your wallet on explorer"
                  >
                    <ArrowUpRight size={12} />
                  </a>
                </Button>
                {props.onExport ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 rounded-full px-2 text-[10px]"
                    onClick={props.onExport}
                  >
                    Export
                  </Button>
                ) : null}
              </div>
            ) : null}
            {ownerGas.status !== 'complete' && props.config.faucetUrl ? (
              <Button asChild variant="outline" size="sm" className="mt-4 w-full rounded-full">
                <a href={props.config.faucetUrl} target="_blank" rel="noreferrer">
                  Get Arc gas
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-muted shadow-none" data-step="account">
          <CardContent className="flex h-full flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Payment funds</span>
              <Badge variant={props.account?.accountAddress ? 'default' : 'warning'}>
                {props.account?.accountAddress ? 'Ready' : 'Not created'}
              </Badge>
            </div>
            <strong className="mt-3 block text-xl">{formatUsdc(accountBalance)} USDC</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              GOL can pay only from this balance.
            </p>
            {props.account?.accountAddress ? (
              <div className="mt-auto pt-5">
                <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <code title={props.account.accountAddress}>
                    {shorten(props.account.accountAddress)}
                  </code>
                  <CopyAddress value={props.account.accountAddress} />
                  <Button asChild variant="ghost" size="icon" className="size-6 rounded-full">
                    <a
                      href={explorerAddressUrl(props.config, props.account.accountAddress)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="View payment account on explorer"
                    >
                      <ArrowUpRight size={12} />
                    </a>
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => props.onAction('fund_account')}
                    disabled={props.busy !== null}
                  >
                    Add funds
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => props.onAction('withdraw')}
                    disabled={props.busy !== null || accountBalance === 0n}
                  >
                    Withdraw
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="mt-5 w-full rounded-full"
                onClick={() => props.onAction('create_account')}
                disabled={ownerGas.status !== 'complete' || props.busy !== null}
              >
                {props.busy === 'create_account' ? 'Confirming...' : 'Create payment account'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted shadow-none" data-step="mandate">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Agent permission</span>
                <Badge variant={mandate && !mandate.revoked ? 'default' : 'warning'}>
                  {mandate && !mandate.revoked ? 'On' : 'Off'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Limits how much GOL can pay and where it can send funds.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => props.onAction('sign_mandate')}
              disabled={!prerequisitesReady || props.busy !== null}
            >
              {mandate && !mandate.revoked ? 'Edit rules' : 'Set payment rules'}
            </Button>
          </div>

          {mandate && !mandate.revoked ? (
            <div className="mt-5 grid gap-3 border-t border-border pt-5 @min-[560px]:grid-cols-3">
              <div>
                <span className="text-xs text-muted-foreground">Total left</span>
                <strong className="mt-1 block text-base">
                  {formatUsdc(ruleRemaining > 0n ? ruleRemaining : 0n)} USDC
                </strong>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Per payment</span>
                <strong className="mt-1 block text-base">
                  {formatUsdc(BigInt(mandate.perPaymentCapUnits))} USDC max
                </strong>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Can pay</span>
                <strong className="mt-1 block truncate text-base" title={recipient?.address ?? ''}>
                  {recipient?.label ?? 'No recipient'}
                </strong>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {accountStep.status === 'complete' && agentStep.status !== 'complete' && (
        <Card className="border-primary/20 bg-accent shadow-none" data-step="agent_wallet">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <strong className="text-sm">Allow GOL to send approved payments</strong>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose one recipient. Your personal wallet stays out of reach.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => props.onAction('provision_agent')}
              disabled={props.busy !== null}
            >
              Choose recipient
            </Button>
          </CardContent>
        </Card>
      )}

      {agentGas && agentStep.status === 'complete' && agentGas.status !== 'complete' && (
        <Card className="border-primary/20 bg-accent shadow-none" data-step="agent_gas">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <strong className="text-sm">Add Arc network fees</strong>
              <p className="mt-1 text-xs text-muted-foreground">
                A separate 1 USDC fee reserve lets GOL submit payments.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => props.onAction('fund_agent_gas')}
              disabled={props.busy !== null}
            >
              Add fee reserve
            </Button>
          </CardContent>
        </Card>
      )}

      {agentMismatch ? (
        <Alert>
          <AlertTitle>Agent access is out of date</AlertTitle>
          <AlertDescription>
            Replace the payment rule so it uses the current agent wallet.
          </AlertDescription>
          <Button
            className="mt-3 rounded-full"
            size="sm"
            onClick={() => props.onAction('sign_mandate')}
            disabled={props.busy !== null}
          >
            Update rule
          </Button>
        </Alert>
      ) : null}
      {mandateStep.status !== 'complete' && !prerequisitesReady ? (
        <p className="text-xs text-muted-foreground">Finish the setup step shown above first.</p>
      ) : null}
    </div>
  );
}

function CopyAddress({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Copy address"
      className="size-6 rounded-full text-muted-foreground hover:text-primary"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <ShieldCheck size={12} /> : <Copy size={12} />}
    </Button>
  );
}

function PrivateKeyWarning(props: {
  onCancel: () => void;
  onContinue: () => Promise<void>;
  error: string | null;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent>
        <span className="font-mono text-[9px] uppercase tracking-[.18em] text-destructive">
          Sensitive wallet export
        </span>
        <DialogTitle id="private-key-warning-title" className="mt-2 text-xl font-semibold">
          Never share your private key
        </DialogTitle>
        <DialogDescription className="mt-3 text-sm leading-copy text-muted-foreground">
          Anyone with this key can control your wallet, change payment rules, and withdraw payment
          funds. GOL cannot recover stolen funds.
        </DialogDescription>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-foreground">
          <li>Make sure nobody can see or record your screen.</li>
          <li>Never paste the key into a website, message, or support chat.</li>
          <li>Store it offline in a secure location.</li>
        </ul>
        <p className="mt-4 rounded-xl bg-warning/10 p-3 text-xs leading-copy text-warning">
          Privy displays your wallet key in its secure export flow. GOL never receives it. The
          payment account is a contract and has no private key.
        </p>
        {props.error && <p className="mt-3 text-xs text-destructive">{props.error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void props.onContinue()}>
            I understand, continue to Privy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConsentPanel(props: {
  config: PublicConfig;
  account: AccountSnapshot | null;
  recipientLabelInput: string;
  setRecipientLabelInput: (value: string) => void;
  recipientInput: string;
  setRecipientInput: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const isKms = props.config.agentSignerProvider === 'aws_kms';
  return (
    <Dialog open onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent data-testid="agent-consent" className="max-w-2xl">
        <span className="font-mono text-[9px] uppercase tracking-[.18em] text-primary">
          Payment access
        </span>
        <DialogTitle className="mt-2 text-xl font-semibold">Choose a payment recipient</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-copy">
          Name and verify the one address GOL may pay. Nothing is selected for you.
        </DialogDescription>
        <div className="mt-5 grid gap-2 rounded-card border border-border bg-muted p-4 text-xs">
          <p>
            <strong>Uses:</strong> payment funds only
          </p>
          <p>
            <strong>Can pay:</strong> one address you approve
          </p>
          <p>
            <strong>Cannot access:</strong> your personal wallet
          </p>
          <p>
            <strong>You stay in control:</strong> change or turn off the rules anytime
          </p>
        </div>
        <Label className="mt-5 block text-xs font-medium" htmlFor="recipient-label">
          Recipient name
        </Label>
        <p className="mt-1 text-xs leading-copy text-muted-foreground">
          This label is only for display. It does not verify the recipient's identity.
        </p>
        <Input
          id="recipient-label"
          className="mt-2"
          placeholder="For example, Design contractor"
          value={props.recipientLabelInput}
          maxLength={100}
          onChange={(event) => props.setRecipientLabelInput(event.target.value)}
        />
        <Label className="mt-5 block text-xs font-medium" htmlFor="recipient">
          Recipient wallet address
        </Label>
        <p className="mt-1 text-xs leading-copy text-muted-foreground">
          Check the complete address. GOL never guesses or prefills a recipient.
        </p>
        <Input
          id="recipient"
          className="mt-2"
          placeholder="0x recipient wallet address"
          value={props.recipientInput}
          onChange={(event) => props.setRecipientInput(event.target.value)}
        />
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button
            onClick={props.onConfirm}
            disabled={
              props.disabled || !props.recipientLabelInput.trim() || !props.recipientInput.trim()
            }
          >
            {isKms ? 'Connect payment agent' : 'Create payment agent'} <ArrowUpRight size={14} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AmountEntryPanel(props: {
  action: 'deposit' | 'withdraw';
  availableUnits: string;
  onCancel: () => void;
  onConfirm: (amountUnits: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isWithdraw = props.action === 'withdraw';

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const units = parseUsdc(amount);
      if (isWithdraw && units > BigInt(props.availableUnits)) {
        setError('This is more than your payment balance.');
        return;
      }
      props.onConfirm(units.toString());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enter a valid USDC amount.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent data-testid="amount-entry">
        <form onSubmit={submit}>
          <span className="font-mono text-[9px] uppercase tracking-[.18em] text-primary">
            {isWithdraw ? 'WITHDRAW PAYMENT FUNDS' : 'ADD PAYMENT FUNDS'}
          </span>
          <DialogTitle className="mt-2 text-xl font-semibold">
            {isWithdraw ? 'Withdraw payment funds' : 'Add payment funds'}
          </DialogTitle>
          <label className="mt-6 block text-xs font-medium" htmlFor="account-amount">
            Amount (USDC)
          </label>
          <Input
            id="account-amount"
            className="mt-2 h-14 text-xl"
            inputMode="decimal"
            autoFocus
            placeholder="0.00"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
          />
          {isWithdraw && (
            <p className="mt-2 text-xs text-muted-foreground">
              Available: {formatUsdc(BigInt(props.availableUnits))} USDC
            </p>
          )}
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={props.onCancel} type="button">
              Cancel
            </Button>
            <Button type="submit">
              Review transfer <ArrowUpRight size={14} />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentBudgetPanel(props: {
  availableUnits: string;
  defaultUnits: string;
  recipient: { address: string; label: string };
  accountAddress: string;
  onCancel: () => void;
  onConfirm: (amountUnits: string, perPaymentCapUnits: string, cumulativeCapUnits: string) => void;
}) {
  const defaultAmount = formatUsdc(BigInt(props.defaultUnits));
  const [fundingAmount, setFundingAmount] = useState(defaultAmount);
  const [perPaymentCap, setPerPaymentCap] = useState(defaultAmount);
  const [cumulativeCap, setCumulativeCap] = useState(defaultAmount);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const fundingUnits = parseUsdc(fundingAmount);
      const perPaymentUnits = parseUsdc(perPaymentCap);
      const cumulativeUnits = parseUsdc(cumulativeCap);
      if (fundingUnits > BigInt(props.availableUnits)) {
        setError('This is more than the USDC available in your wallet.');
        return;
      }
      if (perPaymentUnits > cumulativeUnits) {
        setError('The maximum for one payment cannot exceed the 7-day total.');
        return;
      }
      props.onConfirm(
        fundingUnits.toString(),
        perPaymentUnits.toString(),
        cumulativeUnits.toString(),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enter valid USDC amounts.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent data-testid="payment-budget" className="max-w-xl">
        <form onSubmit={submit}>
          <span className="font-mono text-[9px] uppercase tracking-[.18em] text-primary">
            Funds and rules
          </span>
          <DialogTitle className="mt-2 text-xl font-semibold">Set your payment budget</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-copy">
            Choose the money GOL can use and its limits in one place. Unused funds remain yours and
            can be withdrawn.
          </DialogDescription>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="budget-funding">Payment funds</Label>
              <Input
                id="budget-funding"
                className="mt-2 h-12 text-lg"
                inputMode="decimal"
                autoFocus
                value={fundingAmount}
                onChange={(event) => {
                  setFundingAmount(event.target.value);
                  setError(null);
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Available in your wallet: {formatUsdc(BigInt(props.availableUnits))} USDC
              </p>
            </div>
            <div>
              <Label htmlFor="budget-per-payment">Maximum per payment</Label>
              <Input
                id="budget-per-payment"
                className="mt-2"
                inputMode="decimal"
                value={perPaymentCap}
                onChange={(event) => {
                  setPerPaymentCap(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <div>
              <Label htmlFor="budget-total">Total allowed for 7 days</Label>
              <Input
                id="budget-total"
                className="mt-2"
                inputMode="decimal"
                value={cumulativeCap}
                onChange={(event) => {
                  setCumulativeCap(event.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-card border border-border bg-muted p-4 text-xs sm:grid-cols-2">
            <div className="min-w-0">
              <span className="text-muted-foreground">Funds go to</span>
              <strong className="mt-1 block">Your payment account</strong>
              <code className="mt-1 block truncate text-[10px]" title={props.accountAddress}>
                {shorten(props.accountAddress)}
              </code>
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground">GOL may only pay</span>
              <strong className="mt-1 block">{props.recipient.label}</strong>
              <code className="mt-1 block truncate text-[10px]" title={props.recipient.address}>
                {shorten(props.recipient.address)}
              </code>
            </div>
          </div>

          <div className="mt-4 flex gap-3 rounded-card border border-primary/20 bg-accent p-4 text-xs leading-copy text-accent-foreground">
            <Wallet className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Your wallet will ask twice: first to add the funds, then to save these payment rules.
            </p>
          </div>
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={props.onCancel} type="button">
              Cancel
            </Button>
            <Button type="submit">
              Continue to wallet <ArrowUpRight size={14} />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shows the exact destination and amount before an owner is asked to sign a transfer. */
function TransferReviewPanel(props: {
  review: TransferReview;
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const fromLabel = props.review.kind === 'withdraw' ? 'Payment funds' : 'Your wallet';

  return (
    <Dialog open onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent data-testid="transfer-review">
        <span className="font-mono text-[9px] uppercase tracking-[.18em] text-primary">
          Confirm transfer
        </span>
        <DialogTitle className="mt-2 text-xl font-semibold">{props.review.title}</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-copy">
          Check the amount and destination before your wallet asks for approval.
        </DialogDescription>

        <Card className="mt-5 bg-muted shadow-none">
          <CardContent className="p-5 text-center">
            <span className="text-xs text-muted-foreground">Amount</span>
            <strong className="mt-1 block text-3xl">
              {formatUsdc(BigInt(props.review.amountUnits))} USDC
            </strong>
          </CardContent>
        </Card>

        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-card border border-border p-4">
            <span className="text-muted-foreground">From</span>
            <strong className="mt-1 block">{fromLabel}</strong>
          </div>
          <div className="min-w-0 rounded-card border border-border p-4">
            <span className="text-muted-foreground">To</span>
            <strong className="mt-1 block">{props.review.destinationLabel}</strong>
            <div className="mt-2 flex items-center gap-1 text-muted-foreground">
              <code className="truncate" title={props.review.destination}>
                {shorten(props.review.destination)}
              </code>
              <CopyAddress value={props.review.destination} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-copy text-muted-foreground">{props.review.note}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button onClick={props.onConfirm} disabled={props.disabled}>
            Continue to wallet <ArrowUpRight size={14} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MandateReviewPanel(props: {
  draft: MandateDraft;
  onChange: (draft: MandateDraft) => void;
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const [perPaymentCap, setPerPaymentCap] = useState(
    formatUsdc(BigInt(props.draft.perPaymentCapUnits)),
  );
  const [cumulativeCap, setCumulativeCap] = useState(
    formatUsdc(BigInt(props.draft.cumulativeCapUnits)),
  );
  const [error, setError] = useState<string | null>(null);

  function updateCaps(perPayment: string, cumulative: string) {
    setPerPaymentCap(perPayment);
    setCumulativeCap(cumulative);
    setError(null);
    try {
      const perPaymentUnits = parseUsdc(perPayment);
      const cumulativeUnits = parseUsdc(cumulative);
      if (perPaymentUnits > cumulativeUnits) {
        setError('The maximum for one payment cannot exceed the total spending limit.');
        return;
      }
      props.onChange({
        ...props.draft,
        perPaymentCapUnits: perPaymentUnits.toString(),
        cumulativeCapUnits: cumulativeUnits.toString(),
      });
    } catch {
      setError('Use positive USDC amounts with at most six decimals.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent data-testid="mandate-review" className="max-w-xl">
        <span className="font-mono text-[9px] uppercase tracking-[.18em] text-primary">
          Payment rules
        </span>
        <DialogTitle className="mt-2 text-xl font-semibold">Set payment rules</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-copy">
          Set what GOL is allowed to pay. No money moves when you save these rules.
        </DialogDescription>
        <dl className="mt-5 grid gap-4 text-xs [&_dd]:m-0 [&_dd]:text-foreground [&_dt]:font-medium">
          <div>
            <dt>Maximum for one payment</dt>
            <dd>
              <Input
                className="mt-2"
                aria-label="Per-payment cap (USDC)"
                inputMode="decimal"
                value={perPaymentCap}
                onChange={(event) => updateCaps(event.target.value, cumulativeCap)}
              />
            </dd>
          </div>
          <div>
            <dt>Total allowed for 7 days</dt>
            <dd>
              <Input
                className="mt-2"
                aria-label="Total spending limit (USDC)"
                inputMode="decimal"
                value={cumulativeCap}
                onChange={(event) => updateCaps(perPaymentCap, event.target.value)}
              />
            </dd>
          </div>
          <div className="rounded-card border border-border bg-muted p-4">
            <dt className="text-muted-foreground">Only pay</dt>
            <dd className="mt-1! font-medium">{props.draft.recipientLabel}</dd>
            <code
              className="mt-1 block text-[10px] text-muted-foreground"
              title={props.draft.recipient}
            >
              {shorten(props.draft.recipient)}
            </code>
          </div>
        </dl>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button onClick={props.onConfirm} disabled={props.disabled || !!error}>
            Save payment rules <ArrowUpRight size={14} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AaveTransactionReview({
  review,
  onCancel,
  onConfirm,
  disabled,
}: {
  review: PreparedAaveReview;
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const { transaction } = review;
  const network = transaction.chainId === 1 ? 'Ethereum' : 'Avalanche';
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent data-testid="aave-transaction-review" className="max-w-xl">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-accent">
            <AaveLogo className="size-6" />
          </div>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">
              Aave unsigned transaction
            </span>
            <DialogTitle className="mt-1 text-xl font-semibold">
              Review {review.step === 'approval' ? 'token approval' : 'protocol action'}
            </DialogTitle>
          </div>
        </div>
        <DialogDescription className="mt-3 leading-copy">
          GOL did not sign or submit this transaction. Confirm the network, destination, value and
          calldata before opening your owner wallet.
        </DialogDescription>
        <div className="mt-5 grid gap-3 rounded-xl border border-border bg-muted p-4 text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Network</span>
            <strong className="mt-1 block">{network}</strong>
            <code className="text-[10px] text-muted-foreground">chain {transaction.chainId}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Native value</span>
            <strong className="mt-1 block break-all">{transaction.value} wei</strong>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">From</span>
            <code className="mt-1 block break-all text-[10px]">{transaction.from}</code>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">To</span>
            <code className="mt-1 block break-all text-[10px]">{transaction.to}</code>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">Calldata</span>
            <code className="mt-1 block max-h-24 overflow-y-auto break-all text-[10px] leading-copy">
              {transaction.data}
            </code>
          </div>
          {transaction.operations.length > 0 && (
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Operations</span>
              <strong className="mt-1 block">{transaction.operations.join(', ')}</strong>
            </div>
          )}
        </div>
        {review.warnings.length > 0 && (
          <Alert className="mt-4 border-warning/30 bg-warning/10 text-warning">
            <CircleAlert className="size-4" />
            <div>
              <AlertTitle>Aave notice</AlertTitle>
              <AlertDescription>{review.warnings[0]}</AlertDescription>
            </div>
          </Alert>
        )}
        {review.step === 'approval' && (
          <p className="mt-3 text-xs leading-copy text-muted-foreground">
            This signs only the allowance step. After confirmation, ask the agent to prepare the
            Aave action again using the updated allowance.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={disabled}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={disabled}>
            Review in wallet <ArrowUpRight size={14} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransactionStatus({ tx, config }: { tx: TransactionState; config: PublicConfig }) {
  if (tx.phase === 'idle' || tx.kind === null) return null;
  return (
    <div
      className={`mx-5 mb-5 flex flex-wrap items-center gap-3 rounded-full border px-4 py-3 text-xs sm:mx-6 ${tx.phase === 'failed' ? 'border-destructive/20 bg-destructive/10 text-destructive' : tx.phase === 'confirmed' ? 'border-success/20 bg-success/10 text-success' : 'border-primary/20 bg-accent text-accent-foreground'}`}
      role="status"
      data-testid="owner-transaction"
    >
      <strong>
        {tx.kind === 'aave_action'
          ? tx.phase === 'submitted'
            ? 'Submitted to Aave network'
            : tx.phase === 'confirmed'
              ? 'Confirmed on Aave network'
              : TRANSACTION_PHASES[tx.phase]
          : TRANSACTION_PHASES[tx.phase]}
      </strong>
      {tx.detail && <span className="text-muted-foreground">{tx.detail}</span>}
      {tx.hash && tx.kind !== 'aave_action' && (
        <a
          className="ml-auto font-mono text-[10px]"
          href={explorerTxUrl(config, tx.hash)}
          target="_blank"
          rel="noreferrer"
        >
          {shorten(tx.hash)} ↗
        </a>
      )}
    </div>
  );
}

function freshnessLabel(page: ActivityPage | null, lastGood: ActivityPage | null): string {
  if (!page && !lastGood) return 'NOT LOADED';
  if (page?.integrityMismatch) return 'INTEGRITY MISMATCH';
  if (!page || page.freshness === 'unavailable') {
    return lastGood ? 'UNAVAILABLE: SHOWING LAST INDEXED RESULT' : 'UNAVAILABLE';
  }
  if (page.freshness === 'stale') return 'STALE';
  if (page.freshness === 'catching_up') return 'CATCHING UP';
  if (page.freshness === 'unknown') return 'FRESHNESS UNKNOWN';
  return 'CURRENT';
}

function shorten(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}
