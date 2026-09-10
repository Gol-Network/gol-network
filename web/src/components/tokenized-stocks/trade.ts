import type { BaseMandate, Portfolio, StockToken } from './types';

/**
 * Deterministic trade parsing and mandate evaluation for the Tokenized Stocks tab. These are pure
 * functions with no chain, wallet, or model behind them; they mirror the Arc testnet flow where a
 * bounded instruction is resolved before submission and the policy decides the outcome.
 */

const MAX_INSTRUCTION_LENGTH = 400;

export interface TradeIntent {
  side: 'buy' | 'sell';
  amountUsd: number;
  symbol: string;
}

export type TradeParse =
  | { kind: 'trade'; intent: TradeIntent }
  | { kind: 'clarification'; message: string };

export type TradeRule =
  | 'NONE'
  | 'NO_MANDATE'
  | 'MANDATE_REVOKED'
  | 'MANDATE_EXPIRED'
  | 'TOKEN_NOT_ALLOWED'
  | 'PER_TRADE_CAP'
  | 'CUMULATIVE_CAP'
  | 'INSUFFICIENT_CASH'
  | 'INSUFFICIENT_POSITION';

export interface TradeEvaluation {
  outcome: 'EXECUTED' | 'REFUSED';
  rule: TradeRule;
  detail: string;
  /** Cumulative-cap room in USDC: remaining after the trade when executed, remaining before it when refused. */
  headroomUsd: number;
  shares: number;
  price: number;
}

const BUY_VERBS = ['buy', 'trade', 'invest', 'put', 'deploy', 'long', 'add'];
const SELL_VERBS = ['sell', 'reduce', 'trim', 'exit', 'close', 'short', 'dump'];

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function parseTrade(text: string, tokens: Pick<StockToken, 'symbol' | 'name'>[]): TradeParse {
  const input = text.trim();
  if (input.length === 0 || input.length > MAX_INSTRUCTION_LENGTH) {
    return { kind: 'clarification', message: 'Enter one trade instruction under 400 characters.' };
  }

  const verbMatch = /^([a-z]+)\b/i.exec(input);
  const verb = verbMatch?.[1]?.toLowerCase() ?? '';
  const side: 'buy' | 'sell' | null = BUY_VERBS.includes(verb)
    ? 'buy'
    : SELL_VERBS.includes(verb)
      ? 'sell'
      : null;
  if (side === null) {
    return {
      kind: 'clarification',
      message: 'Start with a verb such as “Buy”, “Sell”, “Trade”, or “Invest”.',
    };
  }

  const amountMatch = /(\d[\d,]*(?:\.\d+)?)\s*(?:usdc|usd|\$|dollars)?/i.exec(
    input.slice(verb.length),
  );
  const amountUsd = amountMatch ? Number(amountMatch[1]!.replace(/,/g, '')) : NaN;
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { kind: 'clarification', message: 'Specify a positive USDC amount, e.g. “500 USDC”.' };
  }

  const symbol = matchSymbol(input, tokens);
  if (symbol === null) {
    return {
      kind: 'clarification',
      message: 'Name one listed token by its exact symbol, e.g. “NVDAx”.',
    };
  }

  return { kind: 'trade', intent: { side, amountUsd: round2(amountUsd), symbol } };
}

function matchSymbol(
  input: string,
  tokens: Pick<StockToken, 'symbol' | 'name'>[],
): string | null {
  const haystack = input.toLowerCase();
  const bySymbol = tokens.filter((token) =>
    new RegExp(`\\b${escapeRegExp(token.symbol.toLowerCase())}\\b`).test(haystack),
  );
  if (bySymbol.length === 1) return bySymbol[0]!.symbol;
  if (bySymbol.length > 1) return null;
  const byName = tokens.filter((token) => {
    const company = token.name.replace(/^Tokenized\s+/i, '').toLowerCase();
    return company.length > 2 && haystack.includes(company);
  });
  return byName.length === 1 ? byName[0]!.symbol : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface EvaluateArgs {
  intent: TradeIntent;
  token: Pick<StockToken, 'price'>;
  mandate: BaseMandate | null;
  portfolio: Portfolio;
  cumulativeSpentUsd: number;
  now?: number;
}

export function evaluateTrade(args: EvaluateArgs): TradeEvaluation {
  const { intent, token, mandate, portfolio, cumulativeSpentUsd } = args;
  const now = args.now ?? nowSeconds();
  const price = token.price;
  const tradeShares = round2(intent.amountUsd / price);
  const capRoom = mandate ? Math.max(0, mandate.cumulativeCapUsd - cumulativeSpentUsd) : 0;
  const refuse = (rule: TradeRule, detail: string, headroomUsd = capRoom): TradeEvaluation => ({
    outcome: 'REFUSED',
    rule,
    detail,
    headroomUsd: round2(headroomUsd),
    shares: tradeShares,
    price,
  });

  if (!mandate) {
    return refuse('NO_MANDATE', 'No Base mandate authorizes the agent desk.', 0);
  }
  if (mandate.revoked) {
    return refuse('MANDATE_REVOKED', `Mandate #${mandate.id} was revoked by the owner.`);
  }
  if (now > mandate.expiresAt) {
    return refuse('MANDATE_EXPIRED', `Mandate #${mandate.id} expired.`);
  }
  if (
    mandate.allowedSymbols !== 'all' &&
    !mandate.allowedSymbols.some((entry) => entry.toLowerCase() === intent.symbol.toLowerCase())
  ) {
    return refuse('TOKEN_NOT_ALLOWED', `${intent.symbol} is not on the mandate allowlist.`);
  }
  if (intent.amountUsd > mandate.perTradeCapUsd) {
    return refuse(
      'PER_TRADE_CAP',
      `The trade exceeds the ${money(mandate.perTradeCapUsd)} per-trade cap.`,
    );
  }
  if (intent.side === 'buy' && cumulativeSpentUsd + intent.amountUsd > mandate.cumulativeCapUsd) {
    return refuse(
      'CUMULATIVE_CAP',
      `The trade exceeds the remaining cumulative cap. ${money(capRoom)} of headroom remained.`,
    );
  }
  if (intent.side === 'buy' && intent.amountUsd > portfolio.cashUsd) {
    return refuse('INSUFFICIENT_CASH', `Only ${money(portfolio.cashUsd)} cash is available.`, capRoom);
  }
  if (intent.side === 'sell') {
    const held = portfolio.positions[intent.symbol];
    const heldValue = held ? held.shares * price : 0;
    if (intent.amountUsd > heldValue + 0.01) {
      return refuse(
        'INSUFFICIENT_POSITION',
        `The book holds only ${money(heldValue)} of ${intent.symbol}.`,
        capRoom,
      );
    }
  }

  const headroomAfter =
    intent.side === 'buy'
      ? Math.max(0, mandate.cumulativeCapUsd - cumulativeSpentUsd - intent.amountUsd)
      : capRoom;
  return {
    outcome: 'EXECUTED',
    rule: 'NONE',
    detail: `Filled ${trimShares(tradeShares)} shares at ${money(price)}.`,
    headroomUsd: round2(headroomAfter),
    shares: tradeShares,
    price,
  };
}

/** Applies an executed trade to the portfolio, returning a new object. */
export function applyTrade(
  portfolio: Portfolio,
  intent: TradeIntent,
  evaluation: TradeEvaluation,
): Portfolio {
  const positions: Portfolio['positions'] = { ...portfolio.positions };
  const current = positions[intent.symbol] ?? { shares: 0, costUsd: 0 };
  if (intent.side === 'buy') {
    positions[intent.symbol] = {
      shares: round4(current.shares + evaluation.shares),
      costUsd: round2(current.costUsd + intent.amountUsd),
    };
    return { cashUsd: round2(portfolio.cashUsd - intent.amountUsd), positions };
  }
  const remaining = Math.max(0, current.shares - evaluation.shares);
  const soldFraction = current.shares > 0 ? evaluation.shares / current.shares : 1;
  const costOut = current.costUsd * Math.min(1, soldFraction);
  if (remaining <= 0.0001) {
    delete positions[intent.symbol];
  } else {
    positions[intent.symbol] = {
      shares: round4(remaining),
      costUsd: round2(Math.max(0, current.costUsd - costOut)),
    };
  }
  return { cashUsd: round2(portfolio.cashUsd + intent.amountUsd), positions };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function money(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function trimShares(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}
