'use client';

import {
  formatUsdc,
  parseUsdc,
  type ActivityPage,
  type GroundedAnswer,
  type LifecycleEventRecord,
} from '@gol/protocol';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  Blocks,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CirclePlus,
  Copy,
  FileCheck2,
  Gauge,
  GitBranch,
  HandCoins,
  KeyRound,
  LoaderCircle,
  Mail,
  Moon,
  ShieldCheck,
  ShieldAlert,
  Sun,
  Trash2,
  UserRoundCheck,
  Wallet,
  WalletCards,
  type LucideIcon,
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
  RecipientDraft,
  RecipientMode,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

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
  recipientDrafts: RecipientDraft[];
  setRecipientDrafts: (value: RecipientDraft[]) => void;
  recipientMode: RecipientMode;
  setRecipientMode: (value: RecipientMode) => void;
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
  onClearConversation: () => void;
  payment: PaymentView;
  page: ActivityPage | null;
  lastGoodPage: ActivityPage | null;
  activityLoading: boolean;
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
  const [sendPaymentOpen, setSendPaymentOpen] = useState(false);
  const [paymentFlowOwner, setPaymentFlowOwner] = useState<'chat' | 'dialog'>('chat');
  const [aaveReview, setAaveReview] = useState<PreparedAaveReview | null>(null);
  const [desktopWorkspace, setDesktopWorkspace] = useState(false);

  const mandate = account?.mandate ?? null;
  const source =
    props.page && props.page.freshness !== 'unavailable' ? props.page : props.lastGoodPage;
  const entries = useMemo(
    () => mergeTimeline(source?.records ?? [], props.pending, source?.lifecycleEvents ?? []),
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
        config={config}
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
        config={config}
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
        <TransactionToast tx={props.tx} config={config} theme={theme} />
        <SetupGate
          {...props}
          theme={theme}
          onThemeChange={selectTheme}
          nextStep={nextSetupStep}
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
      </>
    );
  }

  return (
    <main
      className={`theme-${theme} min-h-screen max-w-none bg-background text-foreground transition-colors xl:h-screen xl:overflow-hidden`}
      id="top"
    >
      <TransactionToast tx={props.tx} config={config} theme={theme} />
      <header className="flex h-[68px] items-center justify-between border-b border-border px-4 sm:h-[76px] sm:px-7">
        <div className="flex items-center gap-3">
          <a className="flex items-center gap-2" href="#top">
            <img className="size-8 sm:size-9" src="/gol-mark-blue.svg" alt="" />
            <span className="font-pixel-wordmark text-[10px] sm:text-sm">GOL Network</span>
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
                  onDeposit={() => setBalanceAction('deposit')}
                  onPay={() => {
                    props.onCancelPreview();
                    setPaymentFlowOwner('dialog');
                    setSendPaymentOpen(true);
                  }}
                />

                <Tabs value={tab} onValueChange={setTab} className="mt-5">
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
                  </div>

                  <TabsContent value="activity" className="mt-6">
                    <WorkspaceActivity
                      config={config}
                      visible={visible}
                      loading={source === null && (props.activityLoading || props.page === null)}
                      recipients={account?.recipients ?? []}
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
                      <h2 className="text-xl font-semibold tracking-tight">Money overview</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        GOL can use payment funds only, not your wallet balance.
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
                              {account?.recipientMode === 'all'
                                ? 'Any wallet address'
                                : 'Approved wallet addresses'}
                            </h3>
                            {account?.recipientMode === 'all' ? (
                              <p className="mt-1 text-sm text-muted-foreground">
                                Every payment must name an exact address.
                              </p>
                            ) : (
                              <ul className="mt-2 grid gap-2 text-sm text-muted-foreground">
                                {account?.recipients
                                  .filter((recipient) => recipient.confirmed)
                                  .map((recipient) => (
                                    <li key={recipient.address}>
                                      {recipient.label}{' '}
                                      <ExplorerAddressLink
                                        config={config}
                                        address={recipient.address}
                                        className="text-[11px]"
                                      />
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </div>
                          <ShieldCheck className="text-primary" />
                        </div>
                      </CardContent>
                    </Card>
                    <Button
                      className="mt-5 rounded-full"
                      variant="outline"
                      onClick={props.onRevoke}
                      disabled={!mandate || mandate.revoked || props.busy !== null}
                    >
                      Turn off agent payments
                    </Button>

                    <Card
                      className="mt-6 overflow-hidden border-primary/20 bg-card shadow-none"
                      aria-labelledby="future-payment-rules-title"
                    >
                      <CardContent className="p-0">
                        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                          <div>
                            <h3
                              id="future-payment-rules-title"
                              className="text-base font-semibold tracking-tight"
                            >
                              Future controls for payment funds
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Planned rules for how GOL can use this account. Not active yet.
                            </p>
                          </div>
                          <Badge className="rounded-full">Coming soon</Badge>
                        </div>
                        <div className="grid gap-px border-t border-border bg-border @min-[620px]:grid-cols-3">
                          <FutureRuleCard
                            icon={UserRoundCheck}
                            title="Approval gates"
                            description="Require an owner or team quorum for larger payments."
                          />
                          <FutureRuleCard
                            icon={CalendarClock}
                            title="Recurring budgets"
                            description="Reset an agent's available allowance on a schedule."
                          />
                          <FutureRuleCard
                            icon={Blocks}
                            title="Protocol allowlist"
                            description="Restrict funds to approved protocols and contract addresses."
                          />
                          <FutureRuleCard
                            icon={HandCoins}
                            title="Query allowance"
                            description="Set a dedicated USDC budget for x402 data services."
                          />
                          <FutureRuleCard
                            icon={Gauge}
                            title="Payment rate limits"
                            description="Limit how often the agent can move payment funds."
                          />
                          <FutureRuleCard
                            icon={BadgeCheck}
                            title="Outcome verification"
                            description="Continue only when the on-chain result matches the intent."
                          />
                          <FutureRuleCard
                            icon={FileCheck2}
                            title="Purpose-bound payments"
                            description="Bind funds to an approved invoice, order, or task proof."
                          />
                          <FutureRuleCard
                            icon={GitBranch}
                            title="Sub-agent budgets"
                            description="Delegate smaller scoped allowances to specialized agents."
                          />
                          <FutureRuleCard
                            icon={ShieldAlert}
                            title="Automatic circuit breaker"
                            description="Pause the agent after repeated refusals or unusual activity."
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {props.consentOpen && (
                  <ConsentPanel
                    config={config}
                    account={account}
                    recipientDrafts={props.recipientDrafts}
                    setRecipientDrafts={props.setRecipientDrafts}
                    recipientMode={props.recipientMode}
                    setRecipientMode={props.setRecipientMode}
                    onCancel={() => props.setConsentOpen(false)}
                    onConfirm={props.onProvisionAgent}
                    disabled={props.busy !== null}
                  />
                )}
                {props.transferReview && (
                  <TransferReviewPanel
                    config={config}
                    review={props.transferReview}
                    onCancel={() => props.setTransferReview(null)}
                    onConfirm={props.onConfirmTransfer}
                    disabled={props.busy !== null}
                  />
                )}
                {balanceAction && account?.accountAddress && (
                  <AmountEntryPanel
                    action={balanceAction}
                    availableUnits={
                      balanceAction === 'deposit'
                        ? account.balances.ownerUsdcUnits
                        : account.balances.accountUsdcUnits
                    }
                    onCancel={() => setBalanceAction(null)}
                    onConfirm={(amountUnits) => {
                      setBalanceAction(null);
                      if (balanceAction === 'deposit') props.onReviewAccountFunding(amountUnits);
                      else props.onReviewWithdraw(amountUnits);
                    }}
                  />
                )}
                {sendPaymentOpen && account && (
                  <SendPaymentDialog
                    config={config}
                    account={account}
                    preview={props.preview}
                    payment={props.payment}
                    onCancel={() => {
                      props.onCancelPreview();
                      setSendPaymentOpen(false);
                    }}
                    onReview={(instruction) => {
                      props.onPreview(instruction);
                    }}
                    onCancelPreview={props.onCancelPreview}
                    onConfirm={props.onSubmitInstruction}
                  />
                )}
                {props.mandateReview && (
                  <MandateReviewPanel
                    config={config}
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
              recipientLabel={
                account?.recipientMode === 'all' ? null : (account?.recipients[0]?.label ?? null)
              }
              draft={chatDraft}
              onDraftChange={setChatDraft}
              onMandatePrompt={(prompt) => {
                setPaymentFlowOwner('chat');
                props.onPreview(prompt);
              }}
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
                  setPaymentFlowOwner('chat');
                  props.onPreview(typeof requested === 'string' ? requested : chatDraft);
                }
              }}
              mandateReady={canRun(props)}
              perPaymentCapUnits={mandate?.perPaymentCapUnits ?? null}
              preview={paymentFlowOwner === 'dialog' ? null : props.preview}
              onConfirmPreview={props.onSubmitInstruction}
              onCancelPreview={props.onCancelPreview}
              onClearConversation={props.onClearConversation}
              {...(paymentFlowOwner === 'dialog' ? {} : { payment: props.payment })}
              {...(props.tx.kind === 'aave_action' ? { transaction: props.tx } : {})}
              answer={props.answer}
              busy={props.asking || props.busy !== null}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <ActionDrawer
        open={drawerOpen}
        recipientLabel={
          account?.recipientMode === 'all'
            ? 'Any address'
            : (account?.recipients[0]?.label ?? 'Approved recipient')
        }
        recipientAddress={
          account?.recipientMode === 'all' ? undefined : account?.recipients[0]?.address
        }
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
  config,
  theme,
  onThemeChange,
  ownerAddress,
}: {
  config: PublicConfig;
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
        <a className="flex items-center gap-2" href="#account">
          <img className="size-8" src="/gol-mark-blue.svg" alt="" />
          <span className="font-pixel-wordmark text-[10px] sm:text-sm">GOL Network</span>
        </a>
        <div className="flex items-center gap-3">
          <ThemeIconButton theme={theme} onChange={onThemeChange} />
          {ownerAddress ? <ExplorerAddressLink config={config} address={ownerAddress} /> : null}
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
            <h1 className="mt-4 text-lg font-semibold">Loading your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Loading your payment account and rules.
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
    onExport: (address: string) => void;
    exportTarget: string | null;
    exportError: string | null;
    onCloseExport: () => void;
    onContinueExport: () => Promise<void>;
  },
) {
  const loading = props.account === null && props.accountError === null;
  const visibleStage = setupStage(props.nextStep.id);
  const reconnectingAgent = Boolean(
    props.nextStep.id === 'agent_wallet' &&
    props.account?.accountAddress &&
    props.account.agentAddress &&
    !props.account.linked,
  );
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
        <a className="flex items-center gap-2" href="#setup">
          <img className="size-8" src="/gol-mark-blue.svg" alt="" />
          <span className="font-pixel-wordmark text-[10px] sm:text-sm">GOL Network</span>
        </a>
        <div className="flex items-center gap-2">
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
                  {reconnectingAgent ? 'Signer maintenance' : 'Account setup'}
                </span>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                  {reconnectingAgent ? 'Reconnect payment agent' : 'Set up agent payments'}
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
                    <ExplorerAddressLink
                      config={props.config}
                      address={
                        (props.nextStep.id === 'agent_gas'
                          ? props.account?.agentAddress
                          : props.account?.ownerAddress)!
                      }
                      display="full"
                      className="mt-1 max-w-full text-xs"
                    />
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
                Your wallet{' '}
                <ExplorerAddressLink
                  config={props.config}
                  address={props.account.ownerAddress}
                  className="inline-flex"
                />
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {props.consentOpen ? (
        <ConsentPanel
          config={props.config}
          account={props.account}
          recipientDrafts={props.recipientDrafts}
          setRecipientDrafts={props.setRecipientDrafts}
          recipientMode={props.recipientMode}
          setRecipientMode={props.setRecipientMode}
          onCancel={() => props.setConsentOpen(false)}
          onConfirm={props.onProvisionAgent}
          disabled={props.busy !== null}
        />
      ) : null}
      {props.transferReview ? (
        <TransferReviewPanel
          config={props.config}
          review={props.transferReview}
          onCancel={() => props.setTransferReview(null)}
          onConfirm={props.onConfirmTransfer}
          disabled={props.busy !== null}
        />
      ) : null}
      {paymentBudgetOpen && props.account ? (
        <PaymentBudgetPanel
          config={props.config}
          availableUnits={props.account.balances.ownerUsdcUnits}
          defaultUnits={props.config.accountTargetUnits}
          recipients={props.account.recipients.filter((recipient) => recipient.confirmed)}
          allowAnyRecipient={props.account.recipientMode === 'all'}
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
          config={props.config}
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
  onDeposit,
  onPay,
}: {
  config: PublicConfig;
  account: AccountSnapshot | null;
  onDeposit: () => void;
  onPay: () => void;
}) {
  const paymentAccountAddress = account?.accountAddress ?? null;
  const paymentFunds = BigInt(account?.balances.accountUsdcUnits ?? '0');
  const mandate = account?.mandate ?? null;
  const rawLimitLeft =
    mandate && !mandate.revoked
      ? BigInt(mandate.cumulativeCapUnits) - BigInt(mandate.spentUnits)
      : 0n;
  const limitLeft = rawLimitLeft > 0n ? rawLimitLeft : 0n;
  const availableToPay = paymentFunds < limitLeft ? paymentFunds : limitLeft;
  const avatarSeed = encodeURIComponent((paymentAccountAddress ?? 'gol-account').toLowerCase());

  return (
    <div className="flex flex-col gap-5 @min-[720px]:flex-row @min-[720px]:items-center @min-[720px]:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <span className="relative shrink-0">
          <Avatar className="size-14 border border-border">
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
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {paymentAccountAddress ? (
              <span className="font-mono">
                Payment account{' '}
                <ExplorerAddressLink
                  config={config}
                  address={paymentAccountAddress}
                  className="inline-flex"
                />
              </span>
            ) : (
              <span className="font-mono">Payment account</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <strong className="text-4xl font-semibold leading-none tracking-tight">
              {formatUsdc(paymentFunds)} USDC
            </strong>
            <span className="text-sm text-muted-foreground">payment funds</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {availableToPay < paymentFunds ? (
              <span className="rounded-full bg-muted px-2.5 py-1">
                {formatUsdc(availableToPay)} USDC usable under rules
              </span>
            ) : null}
            {mandate && !mandate.revoked ? (
              <span className="rounded-full bg-muted px-2.5 py-1">
                {formatUsdc(limitLeft)} USDC rule limit left
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="default"
          className="rounded-full px-5"
          onClick={onDeposit}
          disabled={!account?.accountAddress}
        >
          Add funds
        </Button>
        <Button variant="outline" className="rounded-full px-5" onClick={onPay}>
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

function FutureRuleCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-28 items-start gap-3 bg-card p-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 pt-0.5">
        <strong className="block text-sm">{title}</strong>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function WorkspaceActivity(props: {
  config: PublicConfig;
  visible: ReturnType<typeof mergeTimeline>;
  loading: boolean;
  recipients: AccountSnapshot['recipients'];
  filter: TimelineFilter;
  setFilter: (filter: TimelineFilter) => void;
  pendingCount: number;
  indexingWindowClosed: boolean;
  checkingIndexing: boolean;
  onCheckIndexing: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <span className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[.16em] text-primary">
            <img src="/the-graph-logo.png" alt="" className="size-6 rounded-full object-cover" />
            The Graph
          </span>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">Activity</h3>
        </div>
        <div className="flex items-center gap-5">
          {(['ALL', 'EXECUTED', 'REFUSED'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant="ghost"
              className={`h-auto rounded-none border-b-2 px-0 py-1 text-xs ${props.filter === value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
              onClick={() => props.setFilter(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>
      {props.pendingCount > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 border-l-2 border-primary bg-primary/5 px-4 py-3 text-xs">
          <span className="flex items-center gap-2 text-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            {props.pendingCount} on-chain result awaiting indexing.
          </span>
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
      {props.loading ? (
        <div
          className="grid min-h-[260px] place-items-center text-center"
          aria-live="polite"
          data-testid="activity-loading"
        >
          <div>
            <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
            <strong className="mt-3 block text-sm">Loading on-chain activity</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              Reading account events and indexed payments.
            </p>
          </div>
        </div>
      ) : props.visible.length === 0 && props.pendingCount === 0 ? (
        <div className="grid min-h-[260px] place-items-center text-center">
          <div>
            <WalletCards className="mx-auto text-muted-foreground" size={20} />
            <strong className="mt-3 block text-sm">No activity yet</strong>
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem_8rem_10rem] gap-4 border-b border-border bg-muted/30 px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground md:grid">
            <span>Activity</span>
            <span>Details</span>
            <span>Amount</span>
            <span>Limit left</span>
            <span>Date</span>
          </div>
          <ol className="divide-y divide-border" data-testid="activity-timeline">
            {props.visible.map((entry) => {
              if (entry.kind === 'lifecycle') {
                return (
                  <LifecycleActivityRow key={entry.key} config={props.config} event={entry.event} />
                );
              }
              const record = entry.kind === 'indexed' ? entry.record : entry.pending;
              const txHash =
                entry.kind === 'indexed' ? entry.record.transactionHash : entry.pending.txHash;
              const refused = record.outcome === 'REFUSED';
              const recipient = props.recipients.find(
                (item) => item.address.toLowerCase() === record.recipient.toLowerCase(),
              );
              const timestamp = formatActivityTimestamp(
                entry.kind === 'indexed'
                  ? Number(entry.record.timestamp) * 1_000
                  : entry.pending.confirmedAt,
              );
              return (
                <li
                  key={entry.key}
                  data-pending={entry.kind === 'pending' ? 'true' : 'false'}
                  className={`grid gap-4 px-4 py-4 transition-colors hover:bg-muted/20 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem_8rem_10rem] md:items-center ${entry.kind === 'pending' ? 'opacity-75' : ''}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-md ${refused ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}
                    >
                      {entry.kind === 'pending' ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : refused ? (
                        <CircleAlert className="size-4" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <strong
                        className={`text-base ${refused ? 'text-warning' : 'text-foreground'}`}
                      >
                        {entry.kind === 'pending'
                          ? 'Indexing'
                          : refused
                            ? 'Payment refused'
                            : 'Payment executed'}
                      </strong>
                      <span className="mt-1 block font-mono text-xs text-muted-foreground">
                        Payment ID {shorten(record.requestId)}
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.kind === 'pending'
                          ? `On-chain; indexing pending. ${refused ? `Successful on-chain refusal: ${record.rule}` : 'Payment released by the account contract.'}`
                          : refused
                            ? `Successful on-chain refusal: ${record.rule}`
                            : 'Confirmed on-chain.'}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <span className="mb-1 block text-[11px] uppercase text-muted-foreground md:hidden">
                      Recipient
                    </span>
                    <strong className="block truncate text-base">
                      {recipient?.label ?? 'Wallet address'}
                    </strong>
                    <ExplorerAddressLink
                      config={props.config}
                      address={record.recipient}
                      className="mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <span className="mb-1 block text-[11px] uppercase text-muted-foreground md:hidden">
                      Amount
                    </span>
                    <strong className="text-base">
                      {formatUsdc(BigInt(record.attempted))} USDC
                    </strong>
                  </div>

                  <div>
                    <span className="mb-1 block text-[11px] uppercase text-muted-foreground md:hidden">
                      Limit left
                    </span>
                    <strong className="text-base">
                      {formatUsdc(BigInt(record.headroom))} USDC
                    </strong>
                  </div>

                  <div className="min-w-0 text-xs text-muted-foreground">
                    {timestamp && <span className="block">{timestamp}</span>}
                    <a
                      className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      href={explorerTxUrl(props.config, txHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Transaction
                      <ArrowUpRight className="size-3" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function LifecycleActivityRow({
  config,
  event,
}: {
  config: PublicConfig;
  event: LifecycleEventRecord;
}) {
  const copy = {
    ACCOUNT_CREATED: {
      title: 'Payment account created',
      detail: 'The owner created this payment account on Arc.',
      addressLabel: 'Account',
      address: event.account,
    },
    FUNDS_ADDED: {
      title: 'Funds added',
      detail: 'USDC was added to the payment funds.',
      addressLabel: 'Account',
      address: event.account,
    },
    FUNDS_WITHDRAWN: {
      title: 'Funds withdrawn',
      detail: 'Unused USDC was returned to the owner wallet.',
      addressLabel: 'Account',
      address: event.account,
    },
    MANDATE_CREATED: {
      title: 'Payment rules approved',
      detail: `Mandate ${event.mandateId ?? ''} became active.`,
      addressLabel: 'Agent',
      address: event.agent ?? event.account,
    },
    MANDATE_REVOKED: {
      title: 'Payment rules revoked',
      detail: `Mandate ${event.mandateId ?? ''} can no longer authorize payments.`,
      addressLabel: 'Agent',
      address: event.agent ?? event.account,
    },
  }[event.kind];
  const timestamp = formatActivityTimestamp(Number(event.timestamp) * 1_000);

  return (
    <li className="grid gap-4 px-4 py-4 transition-colors hover:bg-muted/20 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem_8rem_10rem] md:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          {event.kind === 'ACCOUNT_CREATED' ? (
            <WalletCards className="size-4" />
          ) : event.kind === 'FUNDS_ADDED' ? (
            <CirclePlus className="size-4" />
          ) : event.kind === 'FUNDS_WITHDRAWN' ? (
            <ArrowUpRight className="size-4" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
        </span>
        <div className="min-w-0">
          <strong className="text-base text-foreground">{copy.title}</strong>
          <p className="mt-1 text-xs text-muted-foreground">{copy.detail}</p>
        </div>
      </div>

      <div className="min-w-0">
        <span className="mb-1 block text-[11px] uppercase text-muted-foreground">
          {copy.addressLabel}
        </span>
        <ExplorerAddressLink config={config} address={copy.address} className="text-xs" />
      </div>

      <div>
        <span className="mb-1 block text-[11px] uppercase text-muted-foreground md:hidden">
          Amount
        </span>
        <strong className="text-base">
          {event.amountUnits ? `${formatUsdc(BigInt(event.amountUnits))} USDC` : '-'}
        </strong>
      </div>

      <div>
        <span className="mb-1 block text-[11px] uppercase text-muted-foreground md:hidden">
          Limit left
        </span>
        <span className="text-sm text-muted-foreground">-</span>
      </div>

      <div className="min-w-0 text-xs text-muted-foreground">
        {timestamp ? <span className="block">{timestamp}</span> : null}
        <a
          className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
          href={explorerTxUrl(config, event.transactionHash)}
          target="_blank"
          rel="noreferrer"
        >
          Transaction
          <ArrowUpRight className="size-3" />
        </a>
      </div>
    </li>
  );
}

function canRun(props: DashboardProps): boolean {
  return props.steps.some((step) => step.id === 'mandate' && step.status === 'complete');
}

function formatActivityTimestamp(timestampMs: number): string | null {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return null;
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return null;
  const month = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][date.getUTCMonth()];
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${hour}:${minute} UTC`;
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
              <h1 className="font-pixel-wordmark mt-5 text-2xl sm:text-3xl">GOL Network</h1>
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
  const rawRuleRemaining =
    mandate && !mandate.revoked
      ? BigInt(mandate.cumulativeCapUnits) - BigInt(mandate.spentUnits)
      : 0n;
  const ruleRemaining = rawRuleRemaining > 0n ? rawRuleRemaining : 0n;
  const availablePayment = accountBalance < ruleRemaining ? accountBalance : ruleRemaining;
  const recipients = props.account?.recipients.filter((recipient) => recipient.confirmed) ?? [];
  const ownerAvatarSeed = encodeURIComponent(
    (props.account?.ownerAddress ?? 'gol-owner').toLowerCase(),
  );
  const paymentAvatarSeed = encodeURIComponent(
    (props.account?.accountAddress ?? 'gol-payment-account').toLowerCase(),
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2" data-step="account">
        <Card className="shadow-none">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 border border-border">
                  <AvatarImage
                    src={`https://api.dicebear.com/10.x/critters/svg?seed=${ownerAvatarSeed}`}
                    alt=""
                  />
                  <AvatarFallback>
                    <Wallet className="size-5" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-sm font-medium">Your wallet</h3>
                  <p className="text-xs text-muted-foreground">Controlled only by you</p>
                </div>
              </div>
              {ownerGas.status !== 'complete' ? <Badge variant="warning">Needs gas</Badge> : null}
            </div>
            <strong className="mt-5 block text-2xl tracking-tight">
              {formatUsdc(BigInt(props.account?.balances.ownerUsdcUnits ?? '0'))} USDC
            </strong>
            {props.account?.ownerAddress ? (
              <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                <span className="mr-1">Wallet</span>
                <ExplorerAddressLink config={props.config} address={props.account.ownerAddress} />
                <CopyAddress value={props.account.ownerAddress} />
                {props.onExport ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-8 rounded-full px-2.5 text-xs"
                    onClick={props.onExport}
                  >
                    Export
                  </Button>
                ) : null}
              </div>
            ) : null}
            {ownerGas.status !== 'complete' && props.config.faucetUrl ? (
              <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
                <a href={props.config.faucetUrl} target="_blank" rel="noreferrer">
                  Get Arc gas
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/[0.035] shadow-none">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 border border-primary/20">
                  <AvatarImage
                    src={`https://api.dicebear.com/10.x/critters/svg?seed=${paymentAvatarSeed}`}
                    alt=""
                  />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <WalletCards className="size-5" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-sm font-medium">Payment funds</h3>
                  <p className="text-xs text-muted-foreground">Available for GOL payments</p>
                </div>
              </div>
              {!props.account?.accountAddress ? <Badge variant="warning">Not created</Badge> : null}
            </div>
            <div className="mt-5 flex flex-wrap items-baseline gap-2">
              <strong className="text-2xl tracking-tight">{formatUsdc(accountBalance)} USDC</strong>
              <span className="text-xs text-muted-foreground">in funds</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {availablePayment < accountBalance ? (
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {formatUsdc(availablePayment)} USDC usable under rules
                </span>
              ) : null}
              {mandate && !mandate.revoked ? (
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {formatUsdc(ruleRemaining)} USDC rule limit left
                </span>
              ) : null}
            </div>
            {props.account?.accountAddress ? (
              <>
                <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="mr-1">Account</span>
                  <ExplorerAddressLink
                    config={props.config}
                    address={props.account.accountAddress}
                  />
                  <CopyAddress value={props.account.accountAddress} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() => props.onAction('fund_account')}
                    disabled={props.busy !== null}
                  >
                    Add funds
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => props.onAction('withdraw')}
                    disabled={props.busy !== null || accountBalance === 0n}
                  >
                    Withdraw
                  </Button>
                </div>
              </>
            ) : (
              <Button
                className="mt-4 rounded-full"
                onClick={() => props.onAction('create_account')}
                disabled={ownerGas.status !== 'complete' || props.busy !== null}
              >
                {props.busy === 'create_account' ? 'Confirming...' : 'Create payment account'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none" data-step="mandate">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Agent payment rules</span>
                  <Badge variant={mandate && !mandate.revoked ? 'default' : 'warning'}>
                    {mandate && !mandate.revoked ? 'Active' : 'Off'}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Applied to every payment GOL makes.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {agentStep.status === 'complete' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => props.onAction('provision_agent')}
                  disabled={props.busy !== null}
                >
                  Recipients
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => props.onAction('sign_mandate')}
                disabled={!prerequisitesReady || props.busy !== null}
              >
                {mandate && !mandate.revoked ? 'Edit rules' : 'Set payment rules'}
              </Button>
            </div>
          </div>

          {mandate && !mandate.revoked ? (
            <div className="mt-5 grid gap-2 @min-[560px]:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Rule limit left
                </span>
                <strong className="mt-2 block text-base">
                  {formatUsdc(ruleRemaining > 0n ? ruleRemaining : 0n)} USDC
                </strong>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Each payment
                </span>
                <strong className="mt-2 block text-base">
                  Up to {formatUsdc(BigInt(mandate.perPaymentCapUnits))} USDC
                </strong>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Recipient
                </span>
                <strong className="mt-2 block truncate text-base">
                  {props.account?.recipientMode === 'all'
                    ? 'Any address'
                    : recipients.length === 1
                      ? recipients[0]!.label
                      : `${recipients.length} approved addresses`}
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
                Allow any exact address or add the addresses you approve.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => props.onAction('provision_agent')}
              disabled={props.busy !== null}
            >
              Choose recipients
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

function ExplorerAddressLink({
  config,
  address,
  display = 'short',
  className = '',
}: {
  config: PublicConfig;
  address: string;
  display?: 'short' | 'full';
  className?: string;
}) {
  return (
    <a
      href={explorerAddressUrl(config, address)}
      target="_blank"
      rel="noreferrer"
      title={address}
      className={`inline-flex min-w-0 items-center gap-1 font-mono text-primary hover:underline ${className}`}
    >
      <code className="truncate">{display === 'full' ? address : shorten(address)}</code>
      <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
    </a>
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
  recipientDrafts: RecipientDraft[];
  setRecipientDrafts: (value: RecipientDraft[]) => void;
  recipientMode: RecipientMode;
  setRecipientMode: (value: RecipientMode) => void;
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const isKms = props.config.agentSignerProvider === 'aws_kms';
  const allowlistInvalid =
    props.recipientMode === 'allowlist' &&
    (props.recipientDrafts.length === 0 ||
      props.recipientDrafts.length > 20 ||
      props.recipientDrafts.some(
        (recipient) =>
          !recipient.label.trim() || !/^0x[0-9a-fA-F]{40}$/.test(recipient.address.trim()),
      ) ||
      new Set(props.recipientDrafts.map((recipient) => recipient.address.trim().toLowerCase()))
        .size !== props.recipientDrafts.length ||
      new Set(props.recipientDrafts.map((recipient) => recipient.label.trim().toLowerCase()))
        .size !== props.recipientDrafts.length);
  const updateRecipient = (index: number, patch: Partial<RecipientDraft>) => {
    props.setRecipientDrafts(
      props.recipientDrafts.map((recipient, recipientIndex) =>
        recipientIndex === index ? { ...recipient, ...patch } : recipient,
      ),
    );
  };
  return (
    <Dialog open onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent data-testid="agent-consent" className="max-w-2xl">
        <span className="font-mono text-[9px] uppercase tracking-[.18em] text-primary">
          Payment access
        </span>
        <DialogTitle className="mt-2 text-xl font-semibold">Choose payment recipients</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-copy">
          Allow payments to any exact address, or maintain a list of addresses you approve.
        </DialogDescription>
        <div className="mt-5 grid gap-2 rounded-card border border-border bg-muted p-4 text-xs">
          <p>
            <strong>Uses:</strong> payment funds only
          </p>
          <p>
            <strong>Can pay:</strong>{' '}
            {props.recipientMode === 'all' ? 'any exact address' : 'approved addresses only'}
          </p>
          <p>
            <strong>Cannot access:</strong> your personal wallet
          </p>
          <p>
            <strong>You stay in control:</strong> change or turn off the rules anytime
          </p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3" aria-label="Recipient policy">
          <Button
            type="button"
            variant="outline"
            aria-label="Allow all"
            aria-pressed={props.recipientMode === 'all'}
            className={`h-auto min-h-20 items-start justify-start rounded-lg border p-4 text-left ${
              props.recipientMode === 'all'
                ? 'border-primary bg-accent text-accent-foreground'
                : 'bg-card'
            }`}
            onClick={() => props.setRecipientMode('all')}
          >
            <span>
              <strong className="block">Allow all</strong>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Pay any exact address
              </span>
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label="Specific addresses"
            aria-pressed={props.recipientMode === 'allowlist'}
            className={`h-auto min-h-20 items-start justify-start rounded-lg border p-4 text-left ${
              props.recipientMode === 'allowlist'
                ? 'border-primary bg-accent text-accent-foreground'
                : 'bg-card'
            }`}
            onClick={() => props.setRecipientMode('allowlist')}
          >
            <span>
              <strong className="block">Specific addresses</strong>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Maintain an approved list
              </span>
            </span>
          </Button>
        </div>
        {props.recipientMode === 'allowlist' ? (
          <div className="mt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <strong className="text-sm">Approved addresses</strong>
                <p className="mt-1 text-xs leading-copy text-muted-foreground">
                  Add up to 20 exact wallet addresses. Every row is saved together.
                </p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {props.recipientDrafts.length}/20
              </span>
            </div>
            <div className="mt-4 grid max-h-[42vh] gap-3 overflow-y-auto pr-1">
              {props.recipientDrafts.map((recipient, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-lg border border-border bg-muted p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto] sm:items-end"
                >
                  <div>
                    <Label className="text-xs font-medium" htmlFor={`recipient-label-${index}`}>
                      Recipient name{index > 0 ? ` ${index + 1}` : ''}
                    </Label>
                    <Input
                      id={`recipient-label-${index}`}
                      className="mt-2"
                      placeholder="For example, Design contractor"
                      value={recipient.label}
                      maxLength={100}
                      onChange={(event) => updateRecipient(index, { label: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium" htmlFor={`recipient-address-${index}`}>
                      Recipient wallet address{index > 0 ? ` ${index + 1}` : ''}
                    </Label>
                    <Input
                      id={`recipient-address-${index}`}
                      className="mt-2 font-mono"
                      placeholder="0x recipient wallet address"
                      value={recipient.address}
                      onChange={(event) => updateRecipient(index, { address: event.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove recipient ${index + 1}`}
                    disabled={props.recipientDrafts.length === 1}
                    onClick={() =>
                      props.setRecipientDrafts(
                        props.recipientDrafts.filter(
                          (_, recipientIndex) => recipientIndex !== index,
                        ),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3 rounded-lg"
              disabled={props.recipientDrafts.length >= 20}
              onClick={() =>
                props.setRecipientDrafts([...props.recipientDrafts, { label: '', address: '' }])
              }
            >
              <CirclePlus className="size-4" /> Add address
            </Button>
            <p className="mt-3 text-xs leading-copy text-muted-foreground">
              Check every complete address. GOL never guesses or prefills a recipient.
            </p>
          </div>
        ) : (
          <Alert className="mt-5">
            <CircleAlert className="size-4" />
            <div>
              <AlertTitle>Any destination is permitted</AlertTitle>
              <AlertDescription>
                GOL will require an exact wallet address in every payment instruction. Amount and
                expiry limits still apply.
              </AlertDescription>
            </div>
          </Alert>
        )}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button onClick={props.onConfirm} disabled={props.disabled || allowlistInvalid}>
            {isKms ? 'Save recipient policy' : 'Create payment agent'} <ArrowUpRight size={14} />
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
      if (units > BigInt(props.availableUnits)) {
        setError(
          isWithdraw
            ? 'This is more than your payment balance.'
            : 'This is more than the USDC available in your wallet.',
        );
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
          <p className="mt-2 text-xs text-muted-foreground">
            Available: {formatUsdc(BigInt(props.availableUnits))} USDC
          </p>
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

function SendPaymentDialog(props: {
  config: PublicConfig;
  account: AccountSnapshot;
  preview: InstructionPreview | null;
  payment: PaymentView;
  onCancel: () => void;
  onReview: (instruction: string) => void;
  onCancelPreview: () => void;
  onConfirm: () => void;
}) {
  const approvedRecipients = props.account.recipients.filter(
    (recipient) => recipient.confirmed || recipient.allowedByActiveMandate,
  );
  const mandate = props.account.mandate;
  const paymentFunds = BigInt(props.account.balances.accountUsdcUnits);
  const rawLimitLeft =
    mandate && !mandate.revoked
      ? BigInt(mandate.cumulativeCapUnits) - BigInt(mandate.spentUnits)
      : 0n;
  const limitLeft = rawLimitLeft > 0n ? rawLimitLeft : 0n;
  const availableToPay = paymentFunds < limitLeft ? paymentFunds : limitLeft;
  const perPaymentLimit = mandate && !mandate.revoked ? BigInt(mandate.perPaymentCapUnits) : 0n;
  const limitReached = availableToPay === 0n || perPaymentLimit === 0n;
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState(
    props.account.recipientMode === 'all' ? '' : (approvedRecipients[0]?.address ?? ''),
  );
  const [error, setError] = useState<string | null>(null);
  const [reviewRequested, setReviewRequested] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const allowAnyRecipient = props.account.recipientMode === 'all';
  const processing = ['parsing', 'queued', 'signing', 'submitted', 'confirming'].includes(
    props.payment.stage,
  );
  const policyWarning = (() => {
    try {
      const amountUnits = parseUsdc(amount);
      if (amountUnits > perPaymentLimit) {
        return `Above the ${formatUsdc(perPaymentLimit)} USDC per-payment contract limit. You can continue so the contract records an on-chain refusal.`;
      }
      if (amountUnits > limitLeft) {
        return `Above the ${formatUsdc(limitLeft)} USDC contract limit remaining. You can continue so the contract records an on-chain refusal.`;
      }
      if (amountUnits > paymentFunds) {
        return `The payment account holds ${formatUsdc(paymentFunds)} USDC. Contract rules will still be checked on-chain first.`;
      }
    } catch {
      return null;
    }
    return null;
  })();

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const amountUnits = parseUsdc(amount);
      if (amountUnits <= 0n) {
        setError('Enter an amount greater than 0 USDC.');
        return;
      }
      const destination = recipient.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(destination)) {
        setError('Enter a valid recipient wallet address.');
        return;
      }
      if (
        !allowAnyRecipient &&
        !approvedRecipients.some((item) => item.address.toLowerCase() === destination.toLowerCase())
      ) {
        setError('Choose a recipient allowed by your payment rules.');
        return;
      }
      setReviewRequested(true);
      props.onReview(`Pay ${formatUsdc(amountUnits)} USDC to ${destination}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enter a valid USDC amount.');
    }
  }

  function editPayment() {
    props.onCancelPreview();
    setReviewRequested(false);
    setSubmitted(false);
  }

  function confirmPayment() {
    setSubmitted(true);
    props.onConfirm();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !processing && props.onCancel()}>
      <DialogContent data-testid="send-payment-dialog">
        <span className="font-mono text-xs uppercase tracking-[.16em] text-primary">
          GOL payment
        </span>
        <DialogTitle className="mt-2 text-xl font-semibold">Send payment</DialogTitle>

        {!reviewRequested ? (
          <form onSubmit={submit}>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              Enter the amount and recipient.
            </DialogDescription>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/40 p-4">
              <div>
                <span className="text-xs text-muted-foreground">Available now</span>
                <strong className="mt-1 block text-base">{formatUsdc(availableToPay)} USDC</strong>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Each payment</span>
                <strong className="mt-1 block text-base">
                  Up to {formatUsdc(perPaymentLimit)} USDC
                </strong>
              </div>
            </div>

            {limitReached ? (
              <Alert className="mt-4 border-warning/30 bg-warning/10 text-warning">
                <CircleAlert className="size-4 text-warning" aria-hidden="true" />
                <div>
                  <AlertTitle>Payment limit reached</AlertTitle>
                  <AlertDescription>
                    You may continue to demonstrate contract-enforced refusal. No USDC will be sent
                    when a rule rejects the request.
                  </AlertDescription>
                </div>
              </Alert>
            ) : null}

            <div className="mt-6 grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="payment-amount">Amount (USDC)</Label>
                <Input
                  id="payment-amount"
                  className="h-14 rounded-xl text-xl"
                  inputMode="decimal"
                  autoFocus
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setError(null);
                  }}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="payment-recipient">
                  Recipient{allowAnyRecipient ? '' : ` (${approvedRecipients.length})`}
                </Label>
                {allowAnyRecipient ? (
                  <Input
                    id="payment-recipient"
                    className="h-12 rounded-xl font-mono text-sm"
                    placeholder="0x"
                    value={recipient}
                    onChange={(event) => {
                      setRecipient(event.target.value);
                      setError(null);
                    }}
                  />
                ) : (
                  <Select
                    value={recipient}
                    onValueChange={(value) => {
                      setRecipient(value);
                      setError(null);
                    }}
                  >
                    <SelectTrigger id="payment-recipient" className="h-12 rounded-xl">
                      <SelectValue placeholder="Choose a recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedRecipients.map((item) => (
                        <SelectItem key={item.address} value={item.address}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {recipient ? (
                  <ExplorerAddressLink
                    config={props.config}
                    address={recipient}
                    className="text-xs"
                  />
                ) : null}
                {!allowAnyRecipient && approvedRecipients.length > 1 ? (
                  <p className="text-xs text-muted-foreground">
                    Choose from {approvedRecipients.length} approved recipients.
                  </p>
                ) : null}
              </div>
            </div>

            {policyWarning ? (
              <Alert className="mt-4 border-warning/30 bg-warning/10 text-warning">
                <ShieldCheck className="size-4 text-warning" aria-hidden="true" />
                <div>
                  <AlertTitle>Contract-enforced rule</AlertTitle>
                  <AlertDescription>{policyWarning}</AlertDescription>
                </div>
              </Alert>
            ) : null}
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={props.onCancel}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full">
                Review payment <ArrowUpRight size={14} />
              </Button>
            </div>
          </form>
        ) : props.preview && !submitted ? (
          <div data-testid="direct-payment-review">
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              Check these details before sending.
            </DialogDescription>
            <div className="mt-6 rounded-xl border border-border bg-muted/40 p-5">
              <span className="text-xs text-muted-foreground">Amount</span>
              <strong className="mt-1 block text-3xl tracking-tight">
                {props.preview.amountUsdc} USDC
              </strong>
              <Separator className="my-5" />
              <span className="text-xs text-muted-foreground">Recipient</span>
              <strong className="mt-1 block text-base">{props.preview.recipientLabel}</strong>
              <ExplorerAddressLink
                config={props.config}
                address={props.preview.recipient}
                className="mt-1 text-xs"
              />
              <Separator className="my-5" />
              <span className="text-xs text-muted-foreground">Enforced by</span>
              <strong className="mt-1 block text-base">GolAccount contract on Arc</strong>
              {props.account.accountAddress ? (
                <ExplorerAddressLink
                  config={props.config}
                  address={props.account.accountAddress}
                  className="mt-1 text-xs"
                />
              ) : null}
              <p className="mt-3 text-xs leading-copy text-muted-foreground">
                The agent submits this request on-chain. The contract either transfers USDC or
                records a refusal with the violated rule.
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={editPayment}
              >
                Back
              </Button>
              <Button type="button" className="rounded-full" onClick={confirmPayment}>
                Send payment <ArrowUpRight size={14} />
              </Button>
            </div>
          </div>
        ) : (
          <DirectPaymentStatus
            config={props.config}
            payment={props.payment}
            onBack={editPayment}
            onClose={props.onCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DirectPaymentStatus({
  config,
  payment,
  onBack,
  onClose,
}: {
  config: PublicConfig;
  payment: PaymentView;
  onBack: () => void;
  onClose: () => void;
}) {
  const pending = ['idle', 'parsing', 'queued', 'signing', 'submitted', 'confirming'].includes(
    payment.stage,
  );
  const success = payment.stage === 'executed';
  const canRetry = [
    'needs_clarification',
    'refused',
    'signer_blocked',
    'technical_failure',
    'unknown',
  ].includes(payment.stage);
  const title =
    payment.stage === 'executed'
      ? 'Payment sent'
      : payment.stage === 'refused'
        ? 'Payment refused'
        : payment.stage === 'needs_clarification'
          ? 'Check the payment details'
          : payment.stage === 'technical_failure' || payment.stage === 'unknown'
            ? 'Payment could not be completed'
            : 'Processing payment';

  return (
    <div className="mt-6" data-testid="direct-payment-status" aria-live="polite">
      <DialogDescription className="sr-only">{title}</DialogDescription>
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-5">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full ${success ? 'bg-success/10 text-success' : pending ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}
        >
          {success ? (
            <CheckCircle2 className="size-5" />
          ) : pending ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <CircleAlert className="size-5" />
          )}
        </span>
        <div className="min-w-0">
          <strong className="block text-base">{title}</strong>
          <p className="mt-1 text-sm leading-copy text-muted-foreground">
            {payment.detail || PAYMENT_STAGES[payment.stage].detail}
          </p>
          {payment.warning ? <p className="mt-2 text-xs text-warning">{payment.warning}</p> : null}
          {payment.txHash ? (
            <a
              href={payment.explorerUrl ?? explorerTxUrl(config, payment.txHash)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View transaction <ArrowUpRight className="size-4" />
            </a>
          ) : null}
        </div>
      </div>
      {!pending ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {canRetry ? (
            <Button type="button" variant="outline" className="rounded-full" onClick={onBack}>
              Try again
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" className="rounded-full" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PaymentBudgetPanel(props: {
  config: PublicConfig;
  availableUnits: string;
  defaultUnits: string;
  recipients: Array<{ address: string; label: string }>;
  allowAnyRecipient: boolean;
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
              <ExplorerAddressLink
                config={props.config}
                address={props.accountAddress}
                className="mt-1 text-[10px]"
              />
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground">GOL may only pay</span>
              {props.allowAnyRecipient ? (
                <strong className="mt-1 block">Any exact address</strong>
              ) : (
                <ul className="mt-1 grid gap-1">
                  {props.recipients.map((recipient) => (
                    <li key={recipient.address}>
                      <strong>{recipient.label}</strong>{' '}
                      <ExplorerAddressLink
                        config={props.config}
                        address={recipient.address}
                        className="text-[10px]"
                      />
                    </li>
                  ))}
                </ul>
              )}
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
  config: PublicConfig;
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
              <ExplorerAddressLink config={props.config} address={props.review.destination} />
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
  config: PublicConfig;
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
            <dt className="text-muted-foreground">Can pay</dt>
            {props.draft.allowAnyRecipient ? (
              <dd className="mt-1! font-medium">Any exact address</dd>
            ) : (
              <dd className="mt-1! grid gap-2">
                {props.draft.recipients.map((recipient) => (
                  <span key={recipient.address}>
                    <strong>{recipient.label}</strong>{' '}
                    <ExplorerAddressLink
                      config={props.config}
                      address={recipient.address}
                      className="text-[10px]"
                    />
                  </span>
                ))}
              </dd>
            )}
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

function TransactionToast({
  tx,
  config,
  theme,
}: {
  tx: TransactionState;
  config: PublicConfig;
  theme: ThemeMode;
}) {
  const title = transactionStatusTitle(tx);

  useEffect(() => {
    if (!title || tx.kind === null) return;

    const options = {
      id: 'owner-transaction',
      description: tx.detail || undefined,
      ...(tx.hash && tx.kind !== 'aave_action'
        ? {
            action: {
              label: 'View',
              onClick: () => window.open(explorerTxUrl(config, tx.hash!), '_blank', 'noreferrer'),
            },
          }
        : {}),
    };

    if (tx.phase === 'awaiting_signature' || tx.phase === 'submitted') {
      toast.loading(title, options);
      return;
    }
    if (tx.phase === 'confirmed') {
      toast.success(title, { ...options, duration: 5_000 });
      return;
    }
    if (tx.phase === 'rejected') {
      toast.warning(title, { ...options, duration: 4_500 });
      return;
    }
    toast.error(title, { ...options, duration: 6_000 });
  }, [config, title, tx.detail, tx.hash, tx.kind, tx.phase]);

  return (
    <>
      <Toaster theme={theme} />
      {title && (
        <span className="sr-only" role="status" data-testid="owner-transaction">
          {title} {tx.detail}
        </span>
      )}
    </>
  );
}

function transactionStatusTitle(tx: TransactionState): string | null {
  if (tx.phase === 'idle' || tx.kind === null) return null;
  if (tx.kind === 'aave_action' && tx.phase === 'submitted') return 'Submitted to Aave network';
  if (tx.kind === 'aave_action' && tx.phase === 'confirmed') return 'Confirmed on Aave network';
  return TRANSACTION_PHASES[tx.phase];
}

function shorten(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}
