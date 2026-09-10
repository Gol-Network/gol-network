'use client';

import type { Address } from '@gol/protocol';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowDownUp,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Layers3,
  LoaderCircle,
  Network,
  RefreshCw,
  Send,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  MoneyExecutionResult,
  MoneyReceiveInfo,
  MoneySendInput,
  MoneySwapInput,
  MoneySwapQuote,
  MoneyTokenOption,
  TransactionPhase,
  TransactionReporter,
} from '@/client/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TokenIcon } from '@/components/ui/token-icon';

type MoneyAction = 'swap' | 'bridge' | 'send' | 'receive';
type BusyState = 'tokens' | 'quote' | 'execute' | 'receive' | null;

interface ActionDrawerProps {
  open: boolean;
  recipientLabel: string;
  recipientAddress?: string | null | undefined;
  onClose: () => void;
  onListTokens: (chainId: number) => Promise<MoneyTokenOption[]>;
  onQuote: (input: MoneySwapInput) => Promise<MoneySwapQuote>;
  onSwap: (input: MoneySwapInput, report: TransactionReporter) => Promise<MoneyExecutionResult>;
  onSend: (input: MoneySendInput, report: TransactionReporter) => Promise<MoneyExecutionResult>;
  onReceive: (chainId: number, token: string) => Promise<MoneyReceiveInfo>;
}

interface ChainOption {
  id: 84532 | 8453;
  name: string;
  shortName: string;
  testnet: boolean;
  explorer: string;
}

interface TransactionView {
  phase: TransactionPhase;
  detail: string;
  hash: string | null;
}

const CHAINS: ChainOption[] = [
  {
    id: 84532,
    name: 'Base Sepolia',
    shortName: 'Base Sepolia',
    testnet: true,
    explorer: 'https://sepolia.basescan.org',
  },
  {
    id: 8453,
    name: 'Base',
    shortName: 'Base',
    testnet: false,
    explorer: 'https://basescan.org',
  },
];

const FALLBACK_TOKENS: Record<number, MoneyTokenOption[]> = {
  84532: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      decimals: 6,
      chainId: 84532,
      verified: true,
      priceUsd: 1,
      logoUri: null,
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      chainId: 84532,
      verified: true,
      priceUsd: null,
      logoUri: null,
    },
  ],
  8453: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      chainId: 8453,
      verified: true,
      priceUsd: 1,
      logoUri: null,
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      decimals: 6,
      chainId: 8453,
      verified: true,
      priceUsd: 1,
      logoUri: null,
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      chainId: 8453,
      verified: true,
      priceUsd: null,
      logoUri: null,
    },
  ],
};

const ACTIONS = {
  swap: { label: 'Swap', Icon: ArrowLeftRight },
  bridge: { label: 'Bridge', Icon: Layers3 },
  send: { label: 'Send', Icon: Send },
  receive: { label: 'Receive', Icon: ArrowDownToLine },
} satisfies Record<MoneyAction, { label: string; Icon: typeof ArrowLeftRight }>;

const amountPattern = /^\d*(?:\.\d{0,18})?$/;
const addressPattern = /^0x[0-9a-fA-F]{40}$/;

function chainById(chainId: number): ChainOption {
  return CHAINS.find((chain) => chain.id === chainId) ?? CHAINS[0]!;
}

function tokenBySymbol(tokens: MoneyTokenOption[], symbol: string): MoneyTokenOption {
  return tokens.find((token) => token.symbol === symbol) ?? tokens[0]!;
}

function formattedAmount(amount: number, maximumDigits = 8): string {
  if (!Number.isFinite(amount)) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: maximumDigits,
    maximumSignificantDigits: 10,
  }).format(amount);
}

function shortAddress(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The action could not be completed.';
}

function routeFees(quote: MoneySwapQuote): string {
  if (quote.fees.length === 0) return 'Included in quote';
  const grouped = new Map<string, number>();
  for (const fee of quote.fees) {
    grouped.set(fee.symbol, (grouped.get(fee.symbol) ?? 0) + fee.amount);
  }
  return [...grouped.entries()]
    .map(([symbol, amount]) => `${formattedAmount(amount)} ${symbol}`)
    .join(' + ');
}

function eta(seconds: number): string {
  return seconds < 60
    ? `About ${Math.round(seconds)} sec`
    : `About ${Math.round(seconds / 60)} min`;
}

function ChainMark({ chainId }: { chainId: number }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
      <Network className="size-3.5" />
      <span className="sr-only">{chainById(chainId).name}</span>
    </span>
  );
}

function ChainSelect({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (chainId: number) => void;
  label: string;
  disabled?: boolean | undefined;
}) {
  const chain = chainById(value);
  return (
    <Select
      value={String(value)}
      onValueChange={(next) => onChange(Number(next))}
      disabled={disabled ?? false}
    >
      <SelectTrigger aria-label={label} className="h-10 min-w-36 rounded-full bg-background px-3">
        <span className="flex min-w-0 items-center gap-2">
          <ChainMark chainId={value} />
          <span className="truncate">{chain.shortName}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        {CHAINS.map((option) => (
          <SelectItem key={option.id} value={String(option.id)}>
            <span className="flex items-center gap-2">
              <ChainMark chainId={option.id} />
              <span>{option.name}</span>
              {option.testnet && <Badge variant="secondary">Testnet</Badge>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AssetSelect({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: string;
  options: MoneyTokenOption[];
  onChange: (symbol: string) => void;
  label: string;
  disabled?: boolean | undefined;
}) {
  const token = tokenBySymbol(options, value);
  return (
    <Select value={token.symbol} onValueChange={onChange} disabled={disabled ?? false}>
      <SelectTrigger aria-label={label} className="h-12 min-w-32 rounded-full bg-background px-4">
        <span className="flex items-center gap-2 font-semibold">
          <TokenIcon address={token.address} symbol={token.symbol} className="size-6" />
          {token.symbol}
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={`${option.chainId}-${option.address}`} value={option.symbol}>
            <span className="flex items-center gap-2">
              <TokenIcon address={option.address} symbol={option.symbol} className="size-5" />
              <span>
                <span className="block font-medium">{option.symbol}</span>
                <span className="block text-xs text-muted-foreground">{option.name}</span>
              </span>
              {option.verified && <CheckCircle2 className="size-3.5 text-success" />}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AmountLeg({
  label,
  amount,
  amountLabel,
  onAmountChange,
  token,
  tokens,
  onTokenChange,
  chainId,
  onChainChange,
  readOnly,
  tokenLocked,
}: {
  label: string;
  amount: string;
  amountLabel: string;
  onAmountChange?: (value: string) => void;
  token: string;
  tokens: MoneyTokenOption[];
  onTokenChange: (symbol: string) => void;
  chainId: number;
  onChainChange: (chainId: number) => void;
  readOnly?: boolean;
  tokenLocked?: boolean;
}) {
  return (
    <Card className="rounded-card border-border/80 bg-muted/65 shadow-none">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <ChainSelect value={chainId} onChange={onChainChange} label={`${label} network`} />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Input
            aria-label={amountLabel}
            inputMode="decimal"
            value={amount}
            onChange={(event) => onAmountChange?.(event.target.value)}
            readOnly={readOnly ?? false}
            placeholder={readOnly ? 'Quoted after review' : '0'}
            className="h-14 min-w-0 border-0 bg-transparent p-0 text-3xl font-semibold tabular-nums tracking-tight shadow-none focus-visible:ring-0 dark:bg-transparent sm:text-4xl"
          />
          <AssetSelect
            value={token}
            options={tokens}
            onChange={onTokenChange}
            label={`${label} asset`}
            disabled={tokenLocked ?? false}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <strong className="min-w-0 text-right font-medium">{children}</strong>
    </div>
  );
}

function QuoteReview({
  quote,
  fromSymbol,
  toSymbol,
}: {
  quote: MoneySwapQuote;
  fromSymbol: string;
  toSymbol: string;
}) {
  return (
    <Card className="rounded-card bg-card shadow-none">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">
              Live route
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formattedAmount(quote.amountOut.amount)} {quote.amountOut.symbol}
            </p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <RefreshCw className="size-3" /> Quoted
          </Badge>
        </div>
        <Separator />
        <SummaryRow label="Minimum received">
          {formattedAmount(quote.amountOutMin.amount)} {quote.amountOutMin.symbol}
        </SummaryRow>
        <SummaryRow label="Rate">
          1 {fromSymbol} = {formattedAmount(quote.rate, 10)} {toSymbol}
        </SummaryRow>
        {quote.priceImpactBps != null && (
          <SummaryRow label="Price impact">
            <span className={quote.priceImpactBps >= 300 ? 'text-destructive' : ''}>
              {(quote.priceImpactBps / 100).toFixed(2)}%
            </span>
          </SummaryRow>
        )}
        <SummaryRow label="Max slippage">{(quote.slippageBps / 100).toFixed(2)}%</SummaryRow>
        <SummaryRow label="Fees">{routeFees(quote)}</SummaryRow>
        {quote.estimatedDurationSec != null && (
          <SummaryRow label="Estimated time">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" /> {eta(quote.estimatedDurationSec)}
            </span>
          </SummaryRow>
        )}
        <SummaryRow label="Route">
          {quote.route.map((step) => step.tool).join(' → ') || 'Direct'}
        </SummaryRow>
      </CardContent>
    </Card>
  );
}

function TransactionStatus({
  transaction,
  result,
  chainId,
  executing,
}: {
  transaction: TransactionView;
  result: MoneyExecutionResult | null;
  chainId: number;
  executing: boolean;
}) {
  if (transaction.phase === 'idle') return null;
  const rejected = ['rejected', 'reverted', 'failed', 'insufficient_gas'].includes(
    transaction.phase,
  );
  const bridging = executing && transaction.phase === 'confirmed' && !result;
  const working = bridging || ['awaiting_signature', 'submitted'].includes(transaction.phase);
  const bridgeFailed = result?.bridgeState === 'failed' || result?.bridgeState === 'refunded';
  const bridgeDelivered = result?.bridgeState === 'delivered';
  const sourceHash = result?.txHash ?? transaction.hash;
  const explorer = chainById(chainId).explorer;
  const detail =
    result?.bridgeMessage ||
    transaction.detail ||
    (bridging
      ? 'Source confirmed. Waiting for destination delivery.'
      : transaction.phase === 'awaiting_signature'
        ? 'Review and approve this action in your owner wallet.'
        : transaction.phase === 'submitted'
          ? 'Submitted. Waiting for on-chain confirmation.'
          : transaction.phase === 'confirmed'
            ? bridgeDelivered
              ? 'Funds arrived on the destination network.'
              : 'Confirmed on-chain.'
            : transaction.phase === 'rejected'
              ? 'The owner signature was not completed.'
              : 'The action could not be completed.');

  return (
    <Alert
      variant={rejected || bridgeFailed ? 'destructive' : 'default'}
      className="rounded-card"
      aria-live="polite"
    >
      {working ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : rejected || bridgeFailed ? (
        <AlertCircle className="size-4" />
      ) : (
        <CheckCircle2 className="size-4 text-success" />
      )}
      <div className="min-w-0">
        <AlertTitle className="capitalize">
          {bridgeFailed
            ? `Bridge ${result?.bridgeState}`
            : bridgeDelivered
              ? 'Bridge delivered'
              : bridging
                ? 'Bridge in progress'
                : transaction.phase.replaceAll('_', ' ')}
        </AlertTitle>
        <AlertDescription>{detail}</AlertDescription>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {sourceHash && (
            <a
              href={`${explorer}/tx/${sourceHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono underline underline-offset-4"
            >
              Source {shortAddress(sourceHash)} <ExternalLink className="size-3" />
            </a>
          )}
          {result?.bridgeExplorerUrl && (
            <a
              href={result.bridgeExplorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono underline underline-offset-4"
            >
              Destination transaction <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </Alert>
  );
}

export function ActionDrawer(props: ActionDrawerProps) {
  const [action, setAction] = useState<MoneyAction>('swap');
  const [amount, setAmount] = useState('');
  const [fromChainId, setFromChainId] = useState(84532);
  const [toChainId, setToChainId] = useState(8453);
  const [fromSymbol, setFromSymbol] = useState('USDC');
  const [toSymbol, setToSymbol] = useState('ETH');
  const [recipient, setRecipient] = useState(props.recipientAddress ?? '');
  const [slippageBps, setSlippageBps] = useState(50);
  const [tokensByChain, setTokensByChain] =
    useState<Record<number, MoneyTokenOption[]>>(FALLBACK_TOKENS);
  const [tokenFallback, setTokenFallback] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [quote, setQuote] = useState<MoneySwapQuote | null>(null);
  const [receiveInfo, setReceiveInfo] = useState<MoneyReceiveInfo | null>(null);
  const [receiveNonce, setReceiveNonce] = useState(0);
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'address' | 'uri' | null>(null);
  const [transaction, setTransaction] = useState<TransactionView>({
    phase: 'idle',
    detail: '',
    hash: null,
  });
  const [result, setResult] = useState<MoneyExecutionResult | null>(null);
  const listTokensRef = useRef(props.onListTokens);
  const receiveRef = useRef(props.onReceive);
  listTokensRef.current = props.onListTokens;
  receiveRef.current = props.onReceive;

  const fromTokens = tokensByChain[fromChainId] ?? FALLBACK_TOKENS[fromChainId]!;
  const destinationId = action === 'swap' ? fromChainId : toChainId;
  const destinationTokens = tokensByChain[destinationId] ?? FALLBACK_TOKENS[destinationId]!;
  const bridgeTokens = fromTokens.filter((token) =>
    destinationTokens.some((candidate) => candidate.symbol === token.symbol),
  );
  const selectableFromTokens =
    action === 'bridge' && bridgeTokens.length > 0 ? bridgeTokens : fromTokens;
  const fromToken = tokenBySymbol(selectableFromTokens, fromSymbol);
  const effectiveToSymbol = action === 'bridge' ? fromToken.symbol : toSymbol;
  const toToken = tokenBySymbol(destinationTokens, effectiveToSymbol);
  const decimalPlaces = amount.includes('.') ? (amount.split('.')[1]?.length ?? 0) : 0;
  const numericAmount = Number(amount);
  const amountValid =
    amount.length > 0 &&
    amountPattern.test(amount) &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    decimalPlaces <= fromToken.decimals;
  const recipientValid = addressPattern.test(recipient.trim());
  const bridgePairValid = destinationTokens.some(
    (candidate) => candidate.symbol === fromToken.symbol,
  );
  const pairValid = action === 'bridge' ? bridgePairValid : fromToken.address !== toToken.address;
  const tokensLoading = busy === 'tokens';
  const success =
    transaction.phase === 'confirmed' &&
    result?.bridgeState !== 'failed' &&
    result?.bridgeState !== 'refunded';

  const resetReview = () => {
    setReviewing(false);
    setQuote(null);
    setError(null);
    setResult(null);
    setTransaction({ phase: 'idle', detail: '', hash: null });
  };

  useEffect(() => {
    if (!props.open) return;
    let active = true;
    setBusy('tokens');
    setTokenFallback(false);
    void Promise.all(CHAINS.map((chain) => listTokensRef.current(chain.id)))
      .then((lists) => {
        if (!active) return;
        setTokensByChain((current) => {
          const next = { ...current };
          CHAINS.forEach((chain, index) => {
            const listed = lists[index];
            if (listed && listed.length > 0) next[chain.id] = listed;
          });
          return next;
        });
      })
      .catch(() => {
        if (active) setTokenFallback(true);
      })
      .finally(() => {
        if (active) setBusy((current) => (current === 'tokens' ? null : current));
      });
    return () => {
      active = false;
    };
  }, [props.open]);

  useEffect(() => {
    if (props.open) setRecipient(props.recipientAddress ?? '');
  }, [props.open, props.recipientAddress]);

  useEffect(() => {
    if (!props.open || action !== 'receive' || tokensLoading) return;
    let active = true;
    setBusy('receive');
    setError(null);
    setReceiveInfo(null);
    void receiveRef
      .current(fromChainId, fromToken.address)
      .then((info) => {
        if (active) setReceiveInfo(info);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setBusy((current) => (current === 'receive' ? null : current));
      });
    return () => {
      active = false;
    };
  }, [action, fromChainId, fromToken.address, props.open, receiveNonce, tokensLoading]);

  const swapInput = useMemo<MoneySwapInput>(
    () => ({
      fromChainId,
      toChainId: destinationId,
      fromToken,
      toToken,
      amount,
      maxSlippageBps: slippageBps,
    }),
    [amount, destinationId, fromChainId, fromToken, slippageBps, toToken],
  );

  const selectAction = (next: MoneyAction) => {
    setAction(next);
    setReceiveInfo(null);
    setCopied(null);
    if (next === 'bridge') {
      const common = (tokensByChain[fromChainId] ?? []).find((token) =>
        (tokensByChain[toChainId] ?? []).some((candidate) => candidate.symbol === token.symbol),
      );
      if (common) setFromSymbol(common.symbol);
    }
    resetReview();
  };

  const updateAmount = (next: string) => {
    if (next.length > 40 || !amountPattern.test(next)) return;
    setAmount(next);
    resetReview();
  };

  const updateFromChain = (next: number) => {
    const nextTokens = tokensByChain[next] ?? FALLBACK_TOKENS[next]!;
    setFromChainId(next);
    setFromSymbol(nextTokens[0]!.symbol);
    if (action === 'swap') {
      const alternate = nextTokens.find((token) => token.symbol !== nextTokens[0]!.symbol);
      setToSymbol(alternate?.symbol ?? nextTokens[0]!.symbol);
    }
    resetReview();
  };

  const updateToChain = (next: number) => {
    const nextTokens = tokensByChain[next] ?? FALLBACK_TOKENS[next]!;
    setToChainId(next);
    if (!nextTokens.some((token) => token.symbol === fromSymbol)) {
      const common = fromTokens.find((token) =>
        nextTokens.some((candidate) => candidate.symbol === token.symbol),
      );
      if (common) setFromSymbol(common.symbol);
    }
    resetReview();
  };

  const flipRoute = () => {
    if (action === 'swap') {
      setFromSymbol(toToken.symbol);
      setToSymbol(fromToken.symbol);
    } else {
      setFromChainId(toChainId);
      setToChainId(fromChainId);
    }
    resetReview();
  };

  const review = async () => {
    if (!amountValid || (action === 'send' && !recipientValid) || !pairValid) return;
    setError(null);
    setResult(null);
    setTransaction({ phase: 'idle', detail: '', hash: null });
    if (action === 'send') {
      setReviewing(true);
      return;
    }
    setBusy('quote');
    try {
      const nextQuote = await props.onQuote(swapInput);
      if (!nextQuote.supported) {
        throw new Error(
          nextQuote.unsupportedReason ?? 'No supported route was found for this pair.',
        );
      }
      setQuote(nextQuote);
      setReviewing(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const execute = async () => {
    if (!reviewing || busy) return;
    setBusy('execute');
    setError(null);
    setResult(null);
    const report: TransactionReporter = (update) => {
      setTransaction((current) => ({
        phase: update.phase,
        detail: update.detail ?? current.detail,
        hash: update.hash === undefined ? current.hash : update.hash,
      }));
    };
    try {
      const completed =
        action === 'send'
          ? await props.onSend(
              {
                chainId: fromChainId,
                token: fromToken,
                amount,
                recipient: recipient.trim() as Address,
              },
              report,
            )
          : await props.onSwap(swapInput, report);
      setResult(completed);
      if (completed.bridgeState === 'failed' || completed.bridgeState === 'refunded') {
        setError(
          completed.bridgeMessage ??
            `The source transaction confirmed, but the bridge was ${completed.bridgeState}.`,
        );
      }
    } catch (cause) {
      setError(errorMessage(cause));
      setTransaction((current) => ({
        ...current,
        phase:
          current.phase === 'rejected' || current.phase === 'reverted' ? current.phase : 'failed',
        detail: current.detail || errorMessage(cause),
      }));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (kind: 'address' | 'uri', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1_500);
  };

  const mainnetWarning = !chainById(fromChainId).testnet;
  const closeDrawer = () => {
    resetReview();
    setAction('swap');
    setAmount('');
    setReceiveInfo(null);
    setCopied(null);
    props.onClose();
  };

  return (
    <Sheet
      open={props.open}
      onOpenChange={(next) => {
        if (!next && busy !== 'execute') closeDrawer();
      }}
    >
      <SheetContent className="inset-y-0 right-0 h-full max-w-[560px] overflow-hidden rounded-none border bg-card p-0 shadow-panel sm:inset-y-3 sm:right-3 sm:h-auto sm:rounded-card">
        <SheetHeader className="border-b border-border/80 px-5 py-5 pr-16 sm:px-7">
          <div className="flex flex-wrap items-center gap-2.5">
            <SheetTitle>Wallet actions</SheetTitle>
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="size-3" /> Owner signs
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Live quote, simulation, wallet approval, then on-chain confirmation.
          </p>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
          <Tabs value={action} onValueChange={(value) => selectAction(value as MoneyAction)}>
            <TabsList className="grid h-auto w-full grid-cols-4 rounded-full bg-muted p-1.5">
              {(Object.keys(ACTIONS) as MoneyAction[]).map((key) => {
                const Icon = ACTIONS[key].Icon;
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    disabled={busy === 'execute'}
                    className="gap-1.5 rounded-full px-2 py-2.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm sm:text-sm"
                  >
                    <Icon className="hidden size-4 sm:block" />
                    {ACTIONS[key].label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          <div className="mt-6 space-y-4">
            {tokenFallback && (
              <Alert className="rounded-card">
                <AlertCircle className="size-4" />
                <div>
                  <AlertTitle>Using verified token defaults</AlertTitle>
                  <AlertDescription>
                    The live token catalog is unavailable. Quotes still validate the route before
                    signing.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {action === 'receive' ? (
              <Card className="overflow-hidden rounded-card bg-muted/60 shadow-none">
                <CardContent className="p-5 sm:p-7">
                  <div className="flex items-start gap-4">
                    <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                      <ArrowDownToLine className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Receive funds</h3>
                      <p className="mt-1 text-sm leading-copy text-muted-foreground">
                        Deposit directly to your self-custodial Botanary smart account.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Network</Label>
                      <div className="mt-2">
                        <ChainSelect
                          value={fromChainId}
                          onChange={(next) => {
                            updateFromChain(next);
                            setReceiveInfo(null);
                          }}
                          label="Receive network"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Asset</Label>
                      <div className="mt-2">
                        <AssetSelect
                          value={fromToken.symbol}
                          options={fromTokens}
                          onChange={(next) => {
                            setFromSymbol(next);
                            setReceiveInfo(null);
                            setError(null);
                          }}
                          label="Receive asset"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-card border border-border bg-background p-4">
                    <span className="text-xs font-medium uppercase tracking-[.12em] text-muted-foreground">
                      Deposit address
                    </span>
                    {busy === 'receive' || busy === 'tokens' ? (
                      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" /> Preparing your address
                      </div>
                    ) : receiveInfo ? (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <WalletCards className="size-5" />
                        </div>
                        <code className="min-w-0 flex-1 break-all text-xs leading-copy">
                          {receiveInfo.address}
                        </code>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-10 shrink-0 rounded-full"
                          aria-label="Copy receive address"
                          onClick={() => void copy('address', receiveInfo.address)}
                        >
                          {copied === 'address' ? (
                            <Check className="size-4" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">Address unavailable.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => {
                            setError(null);
                            setReceiveNonce((current) => current + 1);
                          }}
                        >
                          <RefreshCw className="size-3.5" /> Retry
                        </Button>
                      </div>
                    )}
                  </div>

                  {receiveInfo?.uri && (
                    <Button
                      variant="outline"
                      className="mt-3 w-full rounded-full"
                      onClick={() => void copy('uri', receiveInfo.uri!)}
                    >
                      {copied === 'uri' ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      {copied === 'uri' ? 'Payment request copied' : 'Copy payment request'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div>
                  <AmountLeg
                    label={action === 'send' ? 'You send' : 'You pay'}
                    amount={amount}
                    amountLabel="Amount"
                    onAmountChange={updateAmount}
                    token={fromToken.symbol}
                    tokens={selectableFromTokens}
                    onTokenChange={(next) => {
                      setFromSymbol(next);
                      resetReview();
                    }}
                    chainId={fromChainId}
                    onChainChange={updateFromChain}
                  />

                  {action !== 'send' && (
                    <div className="relative z-10 -my-5 flex justify-center">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="size-11 rounded-full border-4 border-card"
                        onClick={flipRoute}
                        aria-label={
                          action === 'bridge' ? 'Reverse bridge direction' : 'Reverse assets'
                        }
                      >
                        <ArrowDownUp className="size-5" />
                      </Button>
                    </div>
                  )}

                  {action === 'send' ? (
                    <Card className="mt-3 rounded-card bg-muted/65 shadow-none">
                      <CardContent className="p-5 sm:p-6">
                        <Label htmlFor="money-recipient">Recipient address</Label>
                        <Input
                          id="money-recipient"
                          value={recipient}
                          onChange={(event) => {
                            setRecipient(event.target.value);
                            resetReview();
                          }}
                          placeholder="0x..."
                          className="mt-2 h-12 rounded-full px-4 font-mono text-xs"
                        />
                        {recipient.length > 0 && !recipientValid && (
                          <p className="mt-2 text-xs text-destructive">
                            Enter a complete EVM address.
                          </p>
                        )}
                        {props.recipientAddress && recipient === props.recipientAddress && (
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
                            <CheckCircle2 className="size-3.5" /> Approved recipient:{' '}
                            {props.recipientLabel}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <AmountLeg
                      label="You receive"
                      amount={quote ? formattedAmount(quote.amountOut.amount) : ''}
                      amountLabel="Receive amount"
                      token={toToken.symbol}
                      tokens={destinationTokens}
                      onTokenChange={(next) => {
                        setToSymbol(next);
                        resetReview();
                      }}
                      chainId={destinationId}
                      onChainChange={action === 'bridge' ? updateToChain : updateFromChain}
                      readOnly
                      tokenLocked={action === 'bridge'}
                    />
                  )}
                </div>

                {!amountValid && amount.length > 0 && (
                  <p className="px-1 text-xs text-destructive">
                    Enter a positive amount with no more than {fromToken.decimals} decimal places.
                  </p>
                )}

                {(action === 'swap' || action === 'bridge') && (
                  <Card className="rounded-card bg-transparent shadow-none">
                    <CardContent className="flex items-center justify-between gap-4 p-3 pl-4">
                      <div>
                        <p className="text-sm font-medium">Max slippage</p>
                        <p className="text-xs text-muted-foreground">Applied to minimum received</p>
                      </div>
                      <div className="flex gap-1 rounded-full bg-muted p-1">
                        {[10, 50, 100].map((bps) => (
                          <Button
                            key={bps}
                            type="button"
                            size="sm"
                            variant={slippageBps === bps ? 'secondary' : 'ghost'}
                            className="h-8 rounded-full px-3 text-xs"
                            aria-pressed={slippageBps === bps}
                            onClick={() => {
                              setSlippageBps(bps);
                              resetReview();
                            }}
                          >
                            {bps / 100}%
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {reviewing && action === 'send' && (
                  <Card className="rounded-card bg-card shadow-none">
                    <CardContent className="space-y-3 p-5">
                      <p className="text-xs font-medium uppercase tracking-[.14em] text-muted-foreground">
                        Review transfer
                      </p>
                      <SummaryRow label="Amount">
                        {amount} {fromToken.symbol}
                      </SummaryRow>
                      <SummaryRow label="Network">{chainById(fromChainId).name}</SummaryRow>
                      <SummaryRow label="Recipient">
                        <span className="font-mono text-xs">{shortAddress(recipient)}</span>
                      </SummaryRow>
                    </CardContent>
                  </Card>
                )}

                {reviewing && quote && (
                  <QuoteReview
                    quote={quote}
                    fromSymbol={fromToken.symbol}
                    toSymbol={toToken.symbol}
                  />
                )}

                {action === 'bridge' && !bridgePairValid && (
                  <p className="px-1 text-xs text-destructive">
                    {fromToken.symbol} is not available on {chainById(toChainId).name}.
                  </p>
                )}
              </>
            )}

            {mainnetWarning && (
              <Alert className="rounded-card border-warning/30 bg-warning/10">
                <AlertCircle className="size-4 text-warning" />
                <div>
                  <AlertTitle>Base mainnet</AlertTitle>
                  <AlertDescription>
                    These actions use real assets and network fees.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="rounded-card">
                <AlertCircle className="size-4" />
                <div>
                  <AlertTitle>Action needs attention</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </div>
              </Alert>
            )}

            <TransactionStatus
              transaction={transaction}
              result={result}
              chainId={fromChainId}
              executing={busy === 'execute'}
            />

            {action === 'receive' ? (
              <Button variant="outline" className="h-12 w-full rounded-full" onClick={closeDrawer}>
                Close
              </Button>
            ) : success ? (
              <Button className="h-12 w-full rounded-full" onClick={closeDrawer}>
                <CheckCircle2 className="size-4" /> Done
              </Button>
            ) : reviewing ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-12 rounded-full"
                  onClick={resetReview}
                  disabled={busy === 'execute'}
                >
                  Edit
                </Button>
                <Button
                  className="h-12 rounded-full"
                  onClick={() => void execute()}
                  disabled={busy === 'execute'}
                >
                  {busy === 'execute' ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  Confirm and sign
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-12 rounded-full" onClick={closeDrawer}>
                  Cancel
                </Button>
                <Button
                  className="h-12 rounded-full"
                  onClick={() => void review()}
                  disabled={
                    busy === 'quote' ||
                    !amountValid ||
                    !pairValid ||
                    (action === 'send' && !recipientValid)
                  }
                >
                  {busy === 'quote' ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <ArrowLeftRight className="size-4" />
                  )}
                  Review {action}
                </Button>
              </div>
            )}

            <p className="text-center text-xs leading-copy text-muted-foreground">
              Nothing moves until simulation passes and you approve in your wallet.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
