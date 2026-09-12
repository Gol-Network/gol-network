'use client';

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  MessageSquareText,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  WalletCards,
  Wrench,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';
import { AaveLogo } from '@/components/ui/aave-logo';
import { GolLogo } from '@/components/ui/gol-logo';
import { TokenIcon } from '@/components/ui/token-icon';
import { runGolAgent, type AgentOutcomeFollowup } from '@/client/agui-agent';
import { extractPreparedAaveReview } from '@/client/aave-transactions';
import {
  chatHistoryStorageKey,
  parseChatHistory,
  serializeChatHistory,
  type PersistedChatMessage,
  type PersistedProtocolAction,
  type PersistedToolRun,
} from '@/client/chat-history';
import { GOL_TOOLS, GOL_TOOL_COUNT } from '@/lib/gol-tool-registry';
import { cn } from '@/lib/utils';
import { PAYMENT_STAGES } from '@/client/stages';
import type { TransactionState } from '@/client/types';
import { formatUsdc } from '@gol/protocol';

type ProtocolAction = PersistedProtocolAction;
type ToolRun = PersistedToolRun;
type ChatMessage = PersistedChatMessage & {
  streaming?: boolean | undefined;
};

type OutcomeFollowupView = {
  text: string;
  streaming: boolean;
};

interface AgentChatProps {
  ownerAddress?: string | null | undefined;
  recipientLabel: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onMandatePrompt: (prompt: string) => void;
  onAskRecord: (question: string) => void;
  onOpenActions: () => void;
  onAaveReview: (result: unknown, action: ProtocolAction) => void;
  onGolToolReview: (tool: string, arguments_: Record<string, unknown>) => void;
  mandateReady: boolean;
  perPaymentCapUnits: string | null;
  preview?: {
    amountUsdc: string;
    recipientLabel: string;
    recipient: string;
    mandateId: string;
  } | null;
  onConfirmPreview: () => void;
  onCancelPreview: () => void;
  onClearConversation: () => void;
  payment?: {
    stage: keyof typeof PAYMENT_STAGES;
    requestId?: string | null;
    txHash?: string | null;
    detail: string;
    rule: string | null;
    attemptedUnits: string | null;
    headroomUnits: string | null;
    warning: string | null;
  };
  transaction?: TransactionState;
  answer?: {
    text: string;
    recordCount: number;
    deterministic: boolean;
    indexedBlock: string | null;
    citations: Array<{ explorerUrl: string; txHash: string }>;
  } | null;
  busy?: boolean;
}

function suggestions(recipientLabel: string | null) {
  const paymentSuggestions = recipientLabel
    ? [
        { label: '10 USDC', prompt: `Pay 10 USDC to ${recipientLabel}`, icon: GolLogo },
        { label: '101 USDC', prompt: `Pay 101 USDC to ${recipientLabel}`, icon: GolLogo },
      ]
    : [];
  return [
    {
      label: 'Aave: Best USDC yield',
      prompt: 'Show me the best USDC supply yield on Aave',
      icon: AaveLogo,
    },
    {
      label: 'Aave: My position',
      prompt: 'Review my Aave position and health factor',
      icon: AaveLogo,
    },
    ...paymentSuggestions,
    {
      label: 'Why refused?',
      prompt: 'What was this agent refused, and why?',
      icon: GolLogo,
    },
    { label: 'Review payment rules', prompt: 'Review my GOL payment rules', icon: GolLogo },
  ];
}

const GOL_TOOL_NAMES = new Set<string>(GOL_TOOLS.map((tool) => tool.name));

function initialMessages(): ChatMessage[] {
  return [
    {
      id: 'welcome',
      role: 'agent',
      text: 'I can make payments within your rule, explain blocked payments, and answer questions from on-chain activity.',
    },
  ];
}

function actionFromPrompt(prompt: string, tool?: string): ProtocolAction | undefined {
  const amount = prompt.match(/\b([0-9]+(?:\.[0-9]+)?)\s*(USDC|GHO|ETH|AAVE)\b/i);
  const asset = amount?.[2]?.toUpperCase() ?? 'USDC';
  const value = amount?.[1] ?? 'Not set';
  const verb = prompt.match(/\b(swap|supply|borrow|repay|withdraw)\b/i)?.[1];
  if (verb) {
    return {
      kind: 'aave',
      title: verb.charAt(0).toUpperCase() + verb.slice(1) + ' preview',
      asset,
      amount: value,
      network: 'Best Aave market',
    };
  }
  if (tool?.startsWith('prepare_')) {
    return {
      kind: 'aave',
      title: formatToolName(tool),
      asset,
      amount: value,
      network: 'Prepared Aave network',
    };
  }
  if (/\bbridge\b/i.test(prompt)) {
    return { kind: 'bridge', title: 'Bridge route', asset, amount: value, network: 'Cross-chain' };
  }
  return undefined;
}

const GOL_ACTION_TITLES: Record<string, string> = {
  create_account: 'Create payment account',
  provision_agent: 'Choose payment recipient',
  fund_agent_gas: 'Add Arc fee reserve',
  fund_account: 'Add payment funds',
  withdraw: 'Withdraw payment funds',
  sign_mandate: 'Set payment rules',
  revoke_mandate: 'Turn off agent payments',
  submit_instruction: 'Review payment',
  export_owner_wallet: 'Export personal wallet',
};

function actionFromGolHandoff(
  tool: string,
  handoff: Record<string, unknown>,
  prompt: string,
): ProtocolAction | undefined {
  const title = GOL_ACTION_TITLES[tool];
  if (!title) return undefined;
  const arguments_ =
    handoff.arguments && typeof handoff.arguments === 'object'
      ? (handoff.arguments as Record<string, unknown>)
      : {};
  const amount =
    typeof arguments_.amountUsdc === 'string'
      ? arguments_.amountUsdc
      : (prompt.match(/\b([0-9]+(?:\.[0-9]+)?)\s*USDC\b/i)?.[1] ?? 'Owner selected');
  return {
    kind: 'mandate',
    title,
    asset: tool === 'fund_agent_gas' ? 'Arc fees' : 'USDC',
    amount,
    network: tool === 'export_owner_wallet' ? 'Your wallet' : 'Arc testnet',
  };
}

function extractData(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const envelope = result as { structuredContent?: unknown; content?: Array<{ text?: string }> };
  if (envelope.structuredContent) return envelope.structuredContent;
  const text = envelope.content?.find((entry) => entry.text)?.text;
  if (!text) return result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function resultSummary(result: unknown): Array<[string, string]> {
  const extracted = extractData(result);
  const root =
    extracted && typeof extracted === 'object' && 'data' in extracted
      ? (extracted as { data: unknown }).data
      : extracted;
  if (!root || typeof root !== 'object') return [['Result', String(root ?? 'No data')]];
  const object = root as Record<string, unknown>;
  const keys = [
    'marketsWithPosition',
    'totalSuppliedUsd',
    'totalBorrowedUsd',
    'netWorthUsd',
    'healthFactor',
    'chainsCovered',
    'reserves',
    'positions',
    'proposals',
  ];
  const rows: Array<[string, string]> = [];
  for (const key of keys) {
    const value = object[key];
    if (value === undefined) continue;
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (character) => character.toUpperCase());
    rows.push([
      label,
      Array.isArray(value)
        ? String(value.length) + ' returned'
        : typeof value === 'object'
          ? 'Available'
          : String(value),
    ]);
    if (rows.length === 4) break;
  }
  return rows.length
    ? rows
    : Object.entries(object)
        .slice(0, 4)
        .map(([key, value]) => [
          key,
          Array.isArray(value)
            ? String(value.length) + ' items'
            : typeof value === 'object'
              ? 'Available'
              : String(value),
        ]);
}

function formatToolName(tool: string): string {
  return tool.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

type MarketRow = {
  symbol: string;
  apy: number;
  chainId: number;
  venue: string;
  liquidity?: string;
};

const MARKET_TOKEN_ADDRESSES: Record<string, string> = {
  AAVE: '0x63706e401c06ac8513145b7687A14804d17f814b',
  cbBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  cbETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
  ETH: 'eth-native-base',
  GHO: '0x6Bb7a212910682DCFdbd5BCBb3e28FB4E8da10Ee',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  WETH: '0x4200000000000000000000000000000000000006',
};

function marketTokenAddress(symbol: string): string {
  return MARKET_TOKEN_ADDRESSES[symbol] ?? symbol;
}

function marketRows(result: unknown): MarketRow[] {
  const extracted = extractData(result) as
    | {
        data?: {
          v4?: { markets?: Array<Record<string, unknown>> };
          v3?: { markets?: Array<Record<string, unknown>> };
        };
      }
    | undefined;
  const data = extracted?.data;
  const rows: MarketRow[] = [];
  for (const reserve of data?.v4?.markets ?? []) {
    if (reserve.canSupply !== true || reserve.suppliable === '0') continue;
    rows.push({
      symbol: String(reserve.symbol),
      apy: Number(reserve.supplyApyPct),
      chainId: Number(reserve.chainId),
      venue: String(reserve.spoke ?? 'Aave v4'),
      liquidity: String(reserve.suppliable ?? ''),
    });
  }
  for (const market of data?.v3?.markets ?? []) {
    for (const reserve of (market.reserves as Array<Record<string, unknown>> | undefined) ?? []) {
      if (
        reserve.canSupply !== true ||
        reserve.isFrozen === true ||
        reserve.supplyCapReached === true
      )
        continue;
      const liquidity = reserve.availableLiquidity as { value?: unknown } | undefined;
      if (Number(liquidity?.value ?? 0) <= 0) continue;
      rows.push({
        symbol: String(reserve.symbol),
        apy: Number(reserve.supplyApyPct),
        chainId: Number(market.chainId),
        venue: String(market.name ?? 'Aave v3'),
        liquidity: String(liquidity?.value ?? ''),
      });
    }
  }
  return rows
    .filter((row) => Number.isFinite(row.apy))
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 3);
}

function AaveResultCard({ tool, result }: { tool: string; result: unknown }) {
  const markets = tool === 'get_markets' ? marketRows(result) : [];
  const extracted = extractData(result);
  const blocked =
    extracted !== null &&
    typeof extracted === 'object' &&
    'status' in extracted &&
    extracted.status === 'blocked';
  return (
    <Card className="mt-3 overflow-hidden shadow-panel">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <AaveLogo className="size-6 text-primary" />
            <div>
              <strong className="block text-xs">Aave</strong>
              <span className="text-[10px] text-muted-foreground">Live protocol data</span>
            </div>
          </div>
          <code className="rounded-full bg-accent px-2 py-1 text-[9px] text-accent-foreground">
            {formatToolName(tool)}
          </code>
        </div>
        {markets.length ? (
          <div className="divide-y divide-border">
            {markets.map((market, index) => (
              <div
                key={market.venue + market.symbol + String(index)}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <TokenIcon
                    address={marketTokenAddress(market.symbol)}
                    symbol={market.symbol}
                    className="size-6 shrink-0"
                  />
                  <div className="min-w-0">
                    <strong className="block text-sm">{market.symbol}</strong>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {market.venue}, chain {market.chainId}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <strong className="block text-sm text-success">{market.apy.toFixed(2)}%</strong>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    Supply APY
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {resultSummary(result).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between bg-muted px-4 py-2.5 text-[10px] text-muted-foreground">
          <span>
            {blocked
              ? 'No relay request sent'
              : markets.length
                ? 'Filtered for usable liquidity'
                : 'Live protocol response'}
          </span>
          <span
            className={cn('flex items-center gap-1', blocked ? 'text-warning' : 'text-success')}
          >
            {blocked ? <CircleAlert size={12} /> : <CheckCircle2 size={12} />}
            {blocked ? 'Wallet required' : 'MCP verified'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ProtocolActionCard({
  action,
  onReview,
}: {
  action: ProtocolAction;
  onReview: () => void;
}) {
  const Icon = WalletCards;
  return (
    <Card className="mt-3 overflow-hidden shadow-panel">
      <CardContent className="p-0">
        <div className="flex items-start justify-between border-b border-border p-4">
          <div className="flex gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
              {action.kind === 'aave' ? (
                <AaveLogo className="size-5" />
              ) : action.kind === 'mandate' ? (
                <GolLogo className="size-5" />
              ) : (
                <Icon size={19} />
              )}
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
                {action.kind === 'aave'
                  ? 'Aave MCP action'
                  : action.kind === 'bridge'
                    ? 'Route proposal'
                    : 'GOL payment action'}
              </span>
              <h4 className="mt-1 text-sm font-semibold">{action.title}</h4>
            </div>
          </div>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-medium',
              action.blocked ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning',
            )}
          >
            {action.blocked ? 'Blocked' : 'Review'}
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border px-4 py-4">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
              Amount
            </span>
            <strong className="mt-1 block text-sm">
              {action.amount} {action.asset}
            </strong>
          </div>
          <div className="pl-4">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
              Network
            </span>
            <strong className="mt-1 block truncate text-sm">{action.network}</strong>
          </div>
          <div className="pl-4">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
              Authority
            </span>
            <strong className="mt-1 block text-sm">
              {action.kind === 'mandate' && action.title === 'GOL payment'
                ? 'Agent mandate'
                : 'Owner signs'}
            </strong>
          </div>
        </div>
        <div className="flex items-center justify-between bg-muted px-4 py-3">
          <span className="flex items-center gap-1.5 text-[11px] text-success">
            <ShieldCheck size={13} />
            {action.kind === 'mandate' && action.title === 'GOL payment'
              ? 'Rules checked first'
              : 'Simulation first'}
          </span>
          {!action.blocked && (
            <Button size="sm" onClick={onReview}>
              Open review <ArrowRight size={13} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ChatMessageText({ message, className }: { message: ChatMessage; className?: string }) {
  return (
    <p
      className={cn(
        'text-sm leading-copy',
        message.role === 'agent' ? 'text-foreground' : 'text-primary-foreground',
        className,
      )}
    >
      {message.text}
      {message.streaming ? (
        <span
          aria-hidden
          className="ml-1 inline-block h-[1em] w-0.5 translate-y-[2px] animate-pulse bg-current"
        />
      ) : null}
    </p>
  );
}

function AgentOutcomeMessage({ followup }: { followup: OutcomeFollowupView }) {
  return (
    <div className="flex items-start gap-3" aria-live="polite">
      <img src="/gol-mark-blue.svg" alt="" className="mt-1 size-9 shrink-0" />
      <div className="max-w-[88%] rounded-xl rounded-tl-md border border-border bg-muted px-5 py-3">
        <p className="text-sm leading-copy text-foreground">
          {followup.text}
          {followup.streaming ? (
            <span
              aria-hidden
              className="ml-1 inline-block h-[1em] w-0.5 translate-y-[2px] animate-pulse bg-current"
            />
          ) : null}
        </p>
      </div>
    </div>
  );
}

function InlineOutcomeFollowup({ followup }: { followup: OutcomeFollowupView }) {
  return (
    <p className="mt-3 border-t border-border pt-3 text-sm leading-copy text-foreground">
      {followup.text}
      {followup.streaming ? (
        <span
          aria-hidden
          className="ml-1 inline-block h-[1em] w-0.5 translate-y-[2px] animate-pulse bg-current"
        />
      ) : null}
    </p>
  );
}

export function AgentChat(props: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [toolCount, setToolCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [showPaymentStatus, setShowPaymentStatus] = useState(false);
  const [outcomeFollowups, setOutcomeFollowups] = useState<Record<string, OutcomeFollowupView>>({});
  const [hydratedHistoryScope, setHydratedHistoryScope] = useState<string | null | undefined>(
    undefined,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const followupControllersRef = useRef(new Set<AbortController>());
  const messagesRef = useRef(messages);
  const historyScope = props.ownerAddress?.toLowerCase() ?? null;
  const historyReady = hydratedHistoryScope === historyScope;
  const lastTransactionRef = useRef<string | null>(null);
  const lastPaymentRef = useRef<string | null>(null);
  const lastAnswerRef = useRef<string | null>(null);
  messagesRef.current = messages;

  useEffect(() => {
    setHydratedHistoryScope(undefined);
    if (!historyScope) {
      setMessages(initialMessages());
      setOutcomeFollowups({});
      threadIdRef.current = null;
      setHydratedHistoryScope(null);
      return;
    }

    try {
      const restored = parseChatHistory(
        window.localStorage.getItem(chatHistoryStorageKey(historyScope)),
      );
      setMessages(restored.messages.length > 0 ? restored.messages : initialMessages());
      setOutcomeFollowups(restoreOutcomeFollowups(restored.followups));
      threadIdRef.current = restored.threadId;
    } catch {
      setMessages(initialMessages());
      setOutcomeFollowups({});
      threadIdRef.current = null;
    }
    setHydratedHistoryScope(historyScope);
  }, [historyScope]);

  useEffect(() => {
    if (!historyScope || hydratedHistoryScope !== historyScope) return;
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          chatHistoryStorageKey(historyScope),
          serializeChatHistory(
            messages,
            threadIdRef.current,
            persistableOutcomeFollowups(outcomeFollowups),
          ),
        );
      } catch {
        // Chat remains usable when browser storage is disabled or full.
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [historyScope, hydratedHistoryScope, messages, outcomeFollowups]);

  useEffect(() => {
    void fetch('/api/aave/mcp')
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { tools?: unknown[] };
        setToolCount(GOL_TOOL_COUNT + (body.tools?.length ?? 0));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, outcomeFollowups, props.preview, props.payment?.stage, props.answer]);

  useEffect(
    () => () => {
      abortRef.current?.abort('component unmounted');
      followupControllersRef.current.forEach((controller) =>
        controller.abort('component unmounted'),
      );
    },
    [],
  );

  async function streamOutcomeFollowup(
    slot: string,
    outcomeId: string,
    outcome: AgentOutcomeFollowup,
  ) {
    if (!historyReady || outcomeId === lastOutcomeId(slot, outcomeFollowups)) return;
    setOutcomeFollowups((current) => ({
      ...current,
      [slot]: { text: '', streaming: true },
      [`${slot}:id`]: { text: outcomeId, streaming: false },
    }));
    const controller = new AbortController();
    followupControllersRef.current.add(controller);
    threadIdRef.current ??= crypto.randomUUID();
    try {
      const result = await runGolAgent({
        threadId: threadIdRef.current,
        history: messagesRef.current,
        ownerAddress: props.ownerAddress,
        mandateReady: props.mandateReady,
        outcomeFollowup: outcome,
        abortController: controller,
        onText: (text) =>
          setOutcomeFollowups((current) => ({
            ...current,
            [slot]: { text, streaming: true },
          })),
      });
      setOutcomeFollowups((current) => ({
        ...current,
        [slot]: { text: result.text || outcome.fallback, streaming: false },
      }));
    } catch {
      if (!controller.signal.aborted) {
        setOutcomeFollowups((current) => ({
          ...current,
          [slot]: { text: outcome.fallback, streaming: false },
        }));
      }
    } finally {
      followupControllersRef.current.delete(controller);
    }
  }

  useEffect(() => {
    const transaction = props.transaction;
    if (!transaction?.kind || transaction.phase === 'idle') {
      lastTransactionRef.current = null;
      setOutcomeFollowups((current) => withoutOutcomeSlot(current, 'owner'));
      return;
    }
    if (transaction.phase === 'awaiting_signature' || transaction.phase === 'submitted') {
      lastTransactionRef.current = null;
      setOutcomeFollowups((current) => withoutOutcomeSlot(current, 'owner'));
      return;
    }
    const key = [transaction.kind, transaction.phase, transaction.hash, transaction.detail].join(
      ':',
    );
    if (lastTransactionRef.current === key) return;
    lastTransactionRef.current = key;
    void streamOutcomeFollowup('owner', key, ownerTransactionOutcome(transaction));
  }, [props.transaction]);

  useEffect(() => {
    const payment = props.payment;
    if (!showPaymentStatus || !payment || !PAYMENT_STAGES[payment.stage].terminal) return;
    if (payment.stage === 'idle') return;
    const key = [
      payment.requestId,
      payment.stage,
      payment.txHash,
      payment.rule,
      payment.attemptedUnits,
    ].join(':');
    if (lastPaymentRef.current === key) return;
    lastPaymentRef.current = key;
    void streamOutcomeFollowup('payment', key, paymentOutcome(payment, props.perPaymentCapUnits));
  }, [props.payment, showPaymentStatus]);

  useEffect(() => {
    const answer = props.answer;
    if (!answer) return;
    const key = [answer.indexedBlock, answer.recordCount, answer.text].join(':');
    if (lastAnswerRef.current === key) return;
    lastAnswerRef.current = key;
    void streamOutcomeFollowup('answer', key, indexedAnswerOutcome(answer));
  }, [props.answer]);

  const updateAgentMessage = (id: string, update: Partial<ChatMessage>) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...update } : message)),
    );
  };

  const updateToolRun = (messageId: string, run: ToolRun) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;
        const runs = message.toolRuns ?? [];
        const existing = runs.findIndex((candidate) => candidate.id === run.id);
        return {
          ...message,
          toolRuns:
            existing === -1
              ? [...runs, run]
              : runs.map((candidate) => (candidate.id === run.id ? run : candidate)),
        };
      }),
    );
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const prompt = props.draft.trim();
    if (!prompt || sending || !historyReady) return;
    const isPaymentPrompt = /^pay\s+/i.test(prompt);
    setShowPaymentStatus(isPaymentPrompt);
    props.onDraftChange('');
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: prompt,
    };
    const agentMessageId = crypto.randomUUID();
    const history = [...messages, userMessage];
    setMessages((current) => [
      ...current,
      userMessage,
      { id: agentMessageId, role: 'agent', text: '', streaming: true },
    ]);
    setSending(true);
    setRunStatus('Connecting to LangGraph');
    const controller = new AbortController();
    abortRef.current = controller;
    threadIdRef.current ??= crypto.randomUUID();
    try {
      const streamed = await runGolAgent({
        threadId: threadIdRef.current,
        history,
        ownerAddress: props.ownerAddress,
        mandateReady: props.mandateReady,
        abortController: controller,
        onStatus: setRunStatus,
        onText: (text) => updateAgentMessage(agentMessageId, { text }),
        onToolStart: (callId, tool) =>
          updateToolRun(agentMessageId, {
            id: callId,
            name: tool,
            source: GOL_TOOL_NAMES.has(tool) ? 'gol' : 'aave',
            state: 'running',
          }),
        onToolResult: (tool) => {
          updateToolRun(agentMessageId, {
            id: tool.callId,
            name: tool.tool,
            source: tool.source,
            state: 'complete',
          });
          updateAgentMessage(agentMessageId, {
            tool: tool.tool,
            source: tool.source,
            result: tool.result,
          });
        },
      });
      const preparedAaveReview =
        streamed.tool?.source === 'aave' ? extractPreparedAaveReview(streamed.tool.result) : null;
      let action = preparedAaveReview ? actionFromPrompt(prompt, streamed.tool?.tool) : undefined;
      const handoffTool = streamed.tool?.handoff?.tool;
      if (handoffTool === 'preview_instruction') {
        setShowPaymentStatus(true);
        props.onMandatePrompt(prompt);
        action = {
          kind: 'mandate',
          title: 'GOL payment',
          asset: 'USDC',
          amount: prompt.match(/([0-9]+(?:\.[0-9]+)?)/)?.[1] ?? 'Not set',
          network: 'Arc testnet',
          blocked: !props.mandateReady,
        };
      } else if (handoffTool === 'ask_indexed_question') {
        props.onAskRecord(prompt);
      } else if (handoffTool === 'check_indexing') {
        props.onGolToolReview('check_indexing', {});
      } else if (typeof handoffTool === 'string' && streamed.tool?.handoff) {
        action = actionFromGolHandoff(handoffTool, streamed.tool.handoff, prompt);
      }
      updateAgentMessage(agentMessageId, {
        text: streamed.text,
        action,
        streaming: false,
        ...(streamed.tool?.handoff ? { handoff: streamed.tool.handoff } : {}),
      });
      if (streamed.tool?.source === 'aave') {
        await streamOutcomeFollowup(
          `aave:${agentMessageId}`,
          `${agentMessageId}:${streamed.tool.tool}`,
          aaveResultOutcome(streamed.tool.tool, streamed.tool.result, preparedAaveReview !== null),
        );
      }
    } catch (error) {
      updateAgentMessage(agentMessageId, {
        text: controller.signal.aborted
          ? 'The LangGraph run was stopped before completion.'
          : error instanceof Error
            ? error.message
            : 'The LangGraph agent is unavailable.',
        streaming: false,
      });
      setMessages((current) =>
        current.map((message) =>
          message.id === agentMessageId
            ? {
                ...message,
                toolRuns: message.toolRuns?.map((run) =>
                  run.state === 'running' ? { ...run, state: 'failed' as const } : run,
                ),
              }
            : message,
        ),
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
      setRunStatus(null);
    }
  };

  const liveStage =
    showPaymentStatus && props.payment && !['idle', 'parsing'].includes(props.payment.stage)
      ? props.payment
      : null;

  const clearConversation = () => {
    abortRef.current?.abort('conversation cleared');
    followupControllersRef.current.forEach((controller) =>
      controller.abort('conversation cleared'),
    );
    followupControllersRef.current.clear();
    if (historyScope) window.localStorage.removeItem(chatHistoryStorageKey(historyScope));
    threadIdRef.current = null;
    lastTransactionRef.current = null;
    lastPaymentRef.current = null;
    lastAnswerRef.current = null;
    setMessages(initialMessages());
    setOutcomeFollowups({});
    setShowPaymentStatus(false);
    setRunStatus(null);
    setSending(false);
    props.onDraftChange('');
    props.onClearConversation();
  };

  return (
    <Card className="@container flex min-h-[720px] flex-col overflow-hidden rounded-card shadow-panel xl:h-full xl:min-h-0">
      <header className="flex min-h-[88px] items-center justify-between border-b border-border px-6">
        <div>
          <h2 className="font-pixel-wordmark text-sm">GOL Agent</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            GOL uses Arc. Aave uses reviewed networks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearConversation}
            className="size-10 rounded-full text-muted-foreground"
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <Trash2 className="size-4" />
          </Button>
          <Button
            asChild
            variant="outline"
            size="icon"
            className="relative size-10 rounded-full text-muted-foreground"
          >
            <a
              href="/tools"
              aria-label={toolCount === null ? 'Connecting tools' : `${toolCount} agent tools`}
              title="Agent tools"
            >
              <Wrench className="size-4" />
              {toolCount !== null && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[8px] leading-4 text-primary-foreground"
                >
                  {toolCount}
                </span>
              )}
            </a>
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-7">
        {!historyReady && (
          <div className="flex min-h-48 items-center justify-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Restoring conversation
          </div>
        )}
        {historyReady &&
          messages
            .filter(
              (message) =>
                !(
                  message.handoff?.tool === 'preview_instruction' &&
                  liveStage &&
                  PAYMENT_STAGES[liveStage.stage].terminal
                ),
            )
            .map((message) => (
              <div
                key={message.id}
                className={cn('flex items-start gap-3', message.role === 'user' && 'justify-end')}
              >
                {message.role === 'agent' && (
                  <img src="/gol-mark-blue.svg" alt="" className="mt-1 size-9 shrink-0" />
                )}
                <div
                  className={cn(
                    'max-w-[88%]',
                    message.role === 'agent' &&
                      'rounded-xl rounded-tl-md border border-border bg-muted px-5 py-4',
                    message.role === 'user' &&
                      'rounded-xl rounded-br-md bg-primary px-5 py-3 text-sm text-primary-foreground',
                  )}
                >
                  {message.source === 'aave' && message.result !== undefined ? null : (
                    <ChatMessageText message={message} />
                  )}
                  {message.toolRuns?.length && message.handoff?.tool !== 'preview_instruction' ? (
                    <div className="mt-3 space-y-1.5" aria-label="Agent tool activity">
                      {message.toolRuns.map((run) => (
                        <div
                          key={run.id}
                          className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-[10px] text-muted-foreground"
                        >
                          {run.source === 'aave' ? (
                            <AaveLogo className="size-4 shrink-0" />
                          ) : (
                            <GolLogo className="size-4 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate">
                            {formatToolName(run.name)}
                          </span>
                          <span
                            className={cn(
                              'flex shrink-0 items-center gap-1',
                              run.state === 'complete' && 'text-success',
                              run.state === 'failed' && 'text-destructive',
                            )}
                          >
                            {run.state === 'running' ? (
                              <LoaderCircle className="size-3 animate-spin" />
                            ) : run.state === 'complete' ? (
                              <CheckCircle2 className="size-3" />
                            ) : (
                              <CircleAlert className="size-3" />
                            )}
                            {run.state === 'running'
                              ? 'Running'
                              : run.state === 'complete'
                                ? 'Complete'
                                : 'Failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {message.source === 'aave' && message.tool && message.result !== undefined && (
                    <>
                      <AaveResultCard tool={message.tool} result={message.result} />
                      <ChatMessageText message={message} className="mt-3" />
                      {outcomeFollowups[`aave:${message.id}`] ? (
                        <InlineOutcomeFollowup followup={outcomeFollowups[`aave:${message.id}`]!} />
                      ) : null}
                    </>
                  )}
                  {message.action && message.handoff?.tool !== 'preview_instruction' && (
                    <ProtocolActionCard
                      action={message.action}
                      onReview={() => {
                        if (message.source === 'aave' && message.result !== undefined) {
                          props.onAaveReview(message.result, message.action!);
                          return;
                        }
                        const handoffTool = message.handoff?.tool;
                        const handoffArguments = message.handoff?.arguments;
                        if (
                          typeof handoffTool === 'string' &&
                          handoffTool !== 'preview_instruction'
                        ) {
                          props.onGolToolReview(
                            handoffTool,
                            handoffArguments && typeof handoffArguments === 'object'
                              ? (handoffArguments as Record<string, unknown>)
                              : {},
                          );
                          return;
                        }
                        props.onOpenActions();
                      }}
                    />
                  )}
                </div>
              </div>
            ))}

        {props.preview && (
          <Card
            role="region"
            aria-label="Payment review"
            data-testid="instruction-preview"
            className="ml-10 w-[calc(100%_-_2.5rem)] max-w-md overflow-hidden border-primary/30 bg-card shadow-none"
          >
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <GolLogo className="size-4" />
                  <span className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">
                    Payment review
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-success">
                  <ShieldCheck size={12} /> Rules checked
                </span>
              </div>
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                    Amount
                  </span>
                  <strong className="mt-1 block text-xl">{props.preview.amountUsdc} USDC</strong>
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                    Recipient
                  </span>
                  <strong className="mt-1 block text-sm">{props.preview.recipientLabel}</strong>
                  <code
                    className="mt-1 block truncate text-[10px] text-muted-foreground"
                    title={props.preview.recipient}
                  >
                    {props.preview.recipient}
                  </code>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-border bg-muted px-4 py-3">
                <Button size="sm" variant="ghost" onClick={props.onCancelPreview}>
                  Cancel
                </Button>
                <Button size="sm" onClick={props.onConfirmPreview}>
                  Send payment <ArrowRight size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {liveStage && (
          <>
            <Card
              data-testid="payment-stage"
              className={`ml-10 w-[calc(100%_-_2.5rem)] max-w-md overflow-hidden bg-card shadow-none ${liveStage.stage === 'refused' ? 'border-warning/25' : ''}`}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full ${liveStage.stage === 'executed' ? 'bg-success/10 text-success' : PAYMENT_STAGES[liveStage.stage].terminal ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}
                >
                  {liveStage.stage === 'executed' ? (
                    <CheckCircle2 size={18} />
                  ) : PAYMENT_STAGES[liveStage.stage].terminal ? (
                    <CircleAlert size={18} />
                  ) : (
                    <LoaderCircle className="animate-spin" size={18} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">
                        GOL payment
                      </span>
                      <strong className="mt-0.5 block text-base">
                        {paymentStageTitle(liveStage.stage)}
                      </strong>
                    </div>
                    {liveStage.stage === 'refused' ? (
                      <Badge variant="warning">No USDC sent</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-copy text-muted-foreground">
                    {paymentStageExplanation(liveStage, props.perPaymentCapUnits)}
                  </p>
                  {liveStage.headroomUnits && liveStage.stage === 'refused' ? (
                    <div className="mt-3 inline-flex rounded-full bg-muted px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">Total limit left</span>
                      <strong className="ml-2 font-medium text-foreground">
                        {formatUsdc(BigInt(liveStage.headroomUnits))} USDC
                      </strong>
                    </div>
                  ) : null}
                  {liveStage.warning ? (
                    <p className="mt-2 text-xs text-warning">{liveStage.warning}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            {PAYMENT_STAGES[liveStage.stage].terminal && outcomeFollowups.payment ? (
              <AgentOutcomeMessage followup={outcomeFollowups.payment} />
            ) : null}
          </>
        )}
        {props.answer && (
          <>
            <Card data-testid="grounded-answer" className="ml-10 bg-muted shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.16em] text-primary">
                  <MessageSquareText size={13} /> Indexed evidence, read only
                </div>
                <p className="mt-3 text-sm leading-copy text-foreground">{props.answer.text}</p>
                <p className="mt-3 text-[10px] text-muted-foreground">
                  {props.answer.recordCount} records.{' '}
                  {props.answer.indexedBlock
                    ? 'Indexed through block ' + props.answer.indexedBlock + '. '
                    : ''}
                  {props.answer.deterministic ? 'Deterministic explanation' : 'Model explanation'}
                </p>
                {props.answer.citations.length > 0 && (
                  <div className="citations mt-3 flex flex-wrap gap-2">
                    {props.answer.citations.map((citation) => (
                      <a
                        key={citation.txHash}
                        href={citation.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-border px-2 py-1 font-mono text-[9px] text-primary"
                      >
                        Transaction ↗
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            {outcomeFollowups.answer ? (
              <AgentOutcomeMessage followup={outcomeFollowups.answer} />
            ) : null}
          </>
        )}
        {outcomeFollowups.owner ? <AgentOutcomeMessage followup={outcomeFollowups.owner} /> : null}
        {sending && (
          <div className="ml-10 flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle size={14} className="animate-spin" /> AG-UI:{' '}
            {runStatus ?? 'Streaming from LangGraph'}
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {suggestions(props.recipientLabel).map(({ label, prompt, icon: Icon }) => (
            <Button
              key={label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => props.onDraftChange(prompt)}
              className="shrink-0 rounded-full px-3.5 text-[11px] font-normal text-muted-foreground hover:text-foreground"
            >
              <Icon className="size-3" />
              {label}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => props.onAskRecord('What was this agent refused, and why?')}
            className="shrink-0 rounded-full px-3.5 text-[11px] font-normal text-muted-foreground"
          >
            Ask question
          </Button>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <PromptInput
            value={props.draft}
            onValueChange={props.onDraftChange}
            onSubmit={() => void submit()}
            isLoading={sending}
            maxHeight={128}
            className="flex items-end gap-2 rounded-full border-border bg-muted p-2 pl-5 shadow-none focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/10"
          >
            <PromptInputTextarea
              aria-label="Message GOL Agent"
              placeholder="Ask Aave or tell GOL what to do..."
              className="max-h-32 min-h-10! flex-1 p-2 text-sm text-foreground"
            />
            <PromptInputActions>
              <PromptInputAction tooltip={sending ? 'Stop LangGraph run' : 'Run agent'}>
                <Button
                  size="icon"
                  type={sending ? 'button' : 'submit'}
                  aria-label={sending ? 'Stop agent run' : 'Run agent'}
                  onClick={sending ? () => abortRef.current?.abort('stopped by user') : undefined}
                  disabled={sending ? false : !historyReady || !props.draft.trim() || props.busy}
                  className="size-11 rounded-full"
                >
                  {sending ? <Square size={15} fill="currentColor" /> : <Send size={16} />}
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </form>
      </div>
    </Card>
  );
}

function paymentStageExplanation(
  payment: NonNullable<AgentChatProps['payment']>,
  perPaymentCapUnits: string | null,
): string {
  if (payment.stage !== 'refused') return PAYMENT_STAGES[payment.stage].detail;

  const attempted = payment.attemptedUnits
    ? `${formatUsdc(BigInt(payment.attemptedUnits))} USDC`
    : 'This payment';
  if (payment.rule === 'PER_PAYMENT_CAP' && perPaymentCapUnits) {
    return `${attempted} is above your ${formatUsdc(BigInt(perPaymentCapUnits))} USDC per-payment limit.`;
  }
  if (payment.rule === 'CUMULATIVE_CAP' && payment.headroomUnits) {
    return `${attempted} is above the ${formatUsdc(BigInt(payment.headroomUnits))} USDC remaining in your total limit.`;
  }
  if (payment.rule === 'RECIPIENT_NOT_ALLOWED') {
    return 'This recipient is not approved by your payment rules.';
  }
  if (payment.rule === 'MANDATE_EXPIRED') {
    return 'Your payment rules have expired. Update them before trying again.';
  }
  if (payment.rule === 'MANDATE_REVOKED') {
    return 'Your payment rules are turned off. Enable them before trying again.';
  }
  return 'This payment was blocked by your payment rules.';
}

function paymentOutcomeFallback(payment: NonNullable<AgentChatProps['payment']>): string {
  if (payment.stage === 'executed') {
    return 'Your payment completed successfully. It will appear in Activity after indexing.';
  }
  if (payment.stage === 'refused') {
    if (payment.rule === 'PER_PAYMENT_CAP') {
      return 'No funds moved. Lower the amount to stay within your per-payment limit, then try again.';
    }
    if (payment.rule === 'CUMULATIVE_CAP') {
      return 'No funds moved. Lower the amount or update your total payment limit before trying again.';
    }
    if (payment.rule === 'RECIPIENT_NOT_ALLOWED') {
      return 'No funds moved. Choose an approved recipient or update your recipient rules.';
    }
    return 'No funds moved. Review your payment rules before trying again.';
  }
  if (payment.stage === 'needs_clarification') {
    return 'Nothing was submitted. Send one amount and one approved recipient so I can try again.';
  }
  if (payment.stage === 'signer_blocked') {
    return 'Nothing was submitted. The signer blocked this request because it did not match its permissions.';
  }
  if (payment.stage === 'technical_failure') {
    return 'The transaction failed on-chain and no payment was completed. You can review the details and retry.';
  }
  return 'The transaction status is not confirmed yet. Check Activity before submitting another payment.';
}

function paymentOutcome(
  payment: NonNullable<AgentChatProps['payment']>,
  perPaymentCapUnits: string | null,
): AgentOutcomeFollowup {
  return {
    kind: 'payment',
    status: payment.stage,
    summary: paymentStageExplanation(payment, perPaymentCapUnits),
    facts: {
      attemptedUsdc: payment.attemptedUnits ? formatUsdc(BigInt(payment.attemptedUnits)) : null,
      limitLeftUsdc: payment.headroomUnits ? formatUsdc(BigInt(payment.headroomUnits)) : null,
      rule: payment.rule,
      detail: payment.detail || null,
      warning: payment.warning,
      transactionHash: payment.txHash ?? null,
    },
    fallback: paymentOutcomeFallback(payment),
  };
}

function ownerTransactionFallback(transaction: TransactionState): string {
  if (transaction.phase === 'rejected') {
    return 'You rejected the wallet request, so nothing changed.';
  }
  if (transaction.phase === 'insufficient_gas') {
    return 'The action could not start because the wallet needs more network gas.';
  }
  if (transaction.phase === 'reverted' || transaction.phase === 'failed') {
    return transaction.detail
      ? `The action failed. ${transaction.detail}`
      : 'The action failed and no changes were completed.';
  }
  if (transaction.phase !== 'confirmed') return '';
  if (transaction.kind === 'aave_action') return 'Your Aave action was confirmed on-chain.';
  if (transaction.kind === 'fund_account') return 'Your payment funds were added successfully.';
  if (transaction.kind === 'withdraw') return 'Your payment funds were withdrawn successfully.';
  if (transaction.kind === 'sign_mandate') return 'Your payment rules were updated successfully.';
  if (transaction.kind === 'revoke_mandate') return 'Agent payments are now turned off.';
  if (transaction.kind === 'create_account') return 'Your payment account is ready.';
  if (transaction.kind === 'provision_agent') return 'Your payment recipients are now configured.';
  if (transaction.kind === 'fund_agent_gas') return 'The agent network fee reserve was added.';
  return 'Your action completed successfully.';
}

function ownerTransactionOutcome(transaction: TransactionState): AgentOutcomeFollowup {
  return {
    kind: 'wallet_action',
    status: transaction.phase,
    summary: ownerTransactionFallback(transaction),
    facts: {
      action: transaction.kind,
      transactionHash: transaction.hash,
      detail: transaction.detail || null,
    },
    fallback: ownerTransactionFallback(transaction),
  };
}

function indexedAnswerOutcome(answer: NonNullable<AgentChatProps['answer']>): AgentOutcomeFollowup {
  return {
    kind: 'query',
    status: answer.deterministic ? 'grounded' : 'model_explanation',
    summary: answer.text,
    facts: {
      records: answer.recordCount,
      indexedBlock: answer.indexedBlock,
      citations: answer.citations.length,
    },
    fallback:
      'This is the result from your indexed activity. I can explain any transaction in more detail if you want.',
  };
}

function aaveResultOutcome(
  tool: string,
  result: unknown,
  preparedAction: boolean,
): AgentOutcomeFollowup {
  const extracted = extractData(result);
  const blocked =
    extracted !== null &&
    typeof extracted === 'object' &&
    'status' in extracted &&
    extracted.status === 'blocked';
  return {
    kind: 'query',
    status: blocked ? 'blocked' : preparedAction ? 'prepared' : 'complete',
    summary: preparedAction
      ? 'An unsigned Aave action is ready for owner review.'
      : `The Aave ${formatToolName(tool)} query completed.`,
    facts: Object.fromEntries(resultSummary(result)),
    fallback: blocked
      ? 'The Aave request could not continue. Review the result above for the required next step.'
      : preparedAction
        ? 'Your Aave action is ready for review. Nothing has been submitted yet.'
        : 'Here is your Aave result. I can help you review the details or prepare the next action.',
  };
}

function lastOutcomeId(
  slot: string,
  followups: Record<string, OutcomeFollowupView>,
): string | null {
  return followups[`${slot}:id`]?.text ?? null;
}

function persistableOutcomeFollowups(
  followups: Record<string, OutcomeFollowupView>,
): Record<string, string> {
  const ownerOutcomeIsAave = followups['owner:id']?.text.startsWith('aave_action:') ?? false;
  return Object.fromEntries(
    Object.entries(followups).flatMap(([key, followup]) =>
      !followup.streaming &&
      followup.text &&
      (ownerOutcomeIsAave || (key !== 'owner' && key !== 'owner:id'))
        ? [[key, followup.text]]
        : [],
    ),
  );
}

function restoreOutcomeFollowups(
  followups: Record<string, string> | undefined,
): Record<string, OutcomeFollowupView> {
  const restored = Object.fromEntries(
    Object.entries(followups ?? {}).map(([key, text]) => [key, { text, streaming: false }]),
  );
  return restored['owner:id']?.text.startsWith('aave_action:')
    ? restored
    : withoutOutcomeSlot(restored, 'owner');
}

function withoutOutcomeSlot(
  followups: Record<string, OutcomeFollowupView>,
  slot: string,
): Record<string, OutcomeFollowupView> {
  const next = { ...followups };
  delete next[slot];
  delete next[`${slot}:id`];
  return next;
}

function paymentStageTitle(stage: keyof typeof PAYMENT_STAGES): string {
  if (stage === 'executed') return 'Payment sent';
  if (stage === 'refused') return 'Payment refused';
  if (stage === 'needs_clarification') return 'Payment details needed';
  if (stage === 'signer_blocked') return 'Payment blocked';
  if (stage === 'technical_failure') return 'Payment failed';
  if (stage === 'unknown') return 'Payment status unknown';
  if (stage === 'queued') return 'Payment queued';
  if (stage === 'signing') return 'Preparing payment';
  if (stage === 'submitted' || stage === 'confirming') return 'Confirming payment';
  return 'Reviewing payment';
}
