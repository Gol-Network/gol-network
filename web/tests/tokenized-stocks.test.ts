import { describe, expect, it } from 'vitest';
import { applyTrade, evaluateTrade, parseTrade } from '@/components/tokenized-stocks/trade';
import type { BaseMandate, Portfolio } from '@/components/tokenized-stocks/types';

const TOKENS = [
  { symbol: 'NVDAx', name: 'Tokenized NVIDIA', price: 100 },
  { symbol: 'TSLAx', name: 'Tokenized Tesla', price: 250 },
  { symbol: 'AAPLx', name: 'Tokenized Apple', price: 200 },
];

const FUTURE = Math.floor(Date.now() / 1000) + 7 * 86_400;

function mandate(overrides: Partial<BaseMandate> = {}): BaseMandate {
  return {
    id: 1,
    agent: '0xA6e17DE5c0FFEe0000000000000000000000B45E',
    perTradeCapUsd: 2_000,
    cumulativeCapUsd: 10_000,
    allowedSymbols: 'all',
    expiresAt: FUTURE,
    createdAt: Math.floor(Date.now() / 1000),
    revoked: false,
    txHash: `0x${'ab'.repeat(32)}`,
    ...overrides,
  };
}

function portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return { cashUsd: 25_000, positions: {}, ...overrides };
}

describe('parseTrade', () => {
  it('parses a buy in USDC of a listed symbol', () => {
    const result = parseTrade('Buy 500 USDC of NVDAx', TOKENS);
    expect(result).toEqual({
      kind: 'trade',
      intent: { side: 'buy', amountUsd: 500, symbol: 'NVDAx' },
    });
  });

  it('treats "trade ... into" and "invest ... in" as buys', () => {
    expect(parseTrade('Trade 1,250.50 into TSLAx', TOKENS)).toMatchObject({
      intent: { side: 'buy', amountUsd: 1250.5, symbol: 'TSLAx' },
    });
    expect(parseTrade('Invest $300 in Apple', TOKENS)).toMatchObject({
      intent: { side: 'buy', amountUsd: 300, symbol: 'AAPLx' },
    });
  });

  it('parses a sell', () => {
    expect(parseTrade('Sell 100 USDC of AAPLx', TOKENS)).toMatchObject({
      intent: { side: 'sell', amountUsd: 100, symbol: 'AAPLx' },
    });
  });

  it('asks for clarification on a missing verb, amount, or token', () => {
    expect(parseTrade('NVDAx to the moon', TOKENS).kind).toBe('clarification');
    expect(parseTrade('Buy some NVDAx', TOKENS).kind).toBe('clarification');
    expect(parseTrade('Buy 500 USDC of DOGEx', TOKENS).kind).toBe('clarification');
    expect(parseTrade('', TOKENS).kind).toBe('clarification');
  });
});

describe('evaluateTrade', () => {
  const nvda = { price: 100 };

  it('executes a compliant buy and reports remaining headroom', () => {
    const result = evaluateTrade({
      intent: { side: 'buy', amountUsd: 1_000, symbol: 'NVDAx' },
      token: nvda,
      mandate: mandate(),
      portfolio: portfolio(),
      cumulativeSpentUsd: 0,
    });
    expect(result.outcome).toBe('EXECUTED');
    expect(result.shares).toBe(10);
    expect(result.headroomUsd).toBe(9_000);
  });

  it('refuses when no mandate is active', () => {
    const result = evaluateTrade({
      intent: { side: 'buy', amountUsd: 100, symbol: 'NVDAx' },
      token: nvda,
      mandate: null,
      portfolio: portfolio(),
      cumulativeSpentUsd: 0,
    });
    expect(result).toMatchObject({ outcome: 'REFUSED', rule: 'NO_MANDATE', headroomUsd: 0 });
  });

  it('refuses a trade above the per-trade cap', () => {
    const result = evaluateTrade({
      intent: { side: 'buy', amountUsd: 5_000, symbol: 'NVDAx' },
      token: nvda,
      mandate: mandate({ perTradeCapUsd: 2_000 }),
      portfolio: portfolio(),
      cumulativeSpentUsd: 0,
    });
    expect(result).toMatchObject({ outcome: 'REFUSED', rule: 'PER_TRADE_CAP' });
  });

  it('refuses a buy that breaches the cumulative cap and keeps the prior headroom', () => {
    const result = evaluateTrade({
      intent: { side: 'buy', amountUsd: 2_000, symbol: 'NVDAx' },
      token: nvda,
      mandate: mandate({ cumulativeCapUsd: 10_000 }),
      portfolio: portfolio(),
      cumulativeSpentUsd: 9_000,
    });
    expect(result).toMatchObject({
      outcome: 'REFUSED',
      rule: 'CUMULATIVE_CAP',
      headroomUsd: 1_000,
    });
  });

  it('refuses a token that is not on the allowlist', () => {
    const result = evaluateTrade({
      intent: { side: 'buy', amountUsd: 100, symbol: 'TSLAx' },
      token: { price: 250 },
      mandate: mandate({ allowedSymbols: ['NVDAx'] }),
      portfolio: portfolio(),
      cumulativeSpentUsd: 0,
    });
    expect(result).toMatchObject({ outcome: 'REFUSED', rule: 'TOKEN_NOT_ALLOWED' });
  });

  it('refuses a buy with insufficient cash', () => {
    const result = evaluateTrade({
      intent: { side: 'buy', amountUsd: 1_500, symbol: 'NVDAx' },
      token: nvda,
      mandate: mandate(),
      portfolio: portfolio({ cashUsd: 900 }),
      cumulativeSpentUsd: 0,
    });
    expect(result).toMatchObject({ outcome: 'REFUSED', rule: 'INSUFFICIENT_CASH' });
  });

  it('refuses a sell larger than the held position', () => {
    const result = evaluateTrade({
      intent: { side: 'sell', amountUsd: 1_000, symbol: 'NVDAx' },
      token: nvda,
      mandate: mandate(),
      portfolio: portfolio({ positions: { NVDAx: { shares: 5, costUsd: 400 } } }),
      cumulativeSpentUsd: 0,
    });
    expect(result).toMatchObject({ outcome: 'REFUSED', rule: 'INSUFFICIENT_POSITION' });
  });

  it('does not charge the cumulative budget for sells', () => {
    const result = evaluateTrade({
      intent: { side: 'sell', amountUsd: 400, symbol: 'NVDAx' },
      token: nvda,
      mandate: mandate(),
      portfolio: portfolio({ positions: { NVDAx: { shares: 10, costUsd: 900 } } }),
      cumulativeSpentUsd: 9_800,
    });
    expect(result.outcome).toBe('EXECUTED');
  });
});

describe('applyTrade', () => {
  it('moves cash into a new position on a buy', () => {
    const start = portfolio({ cashUsd: 5_000 });
    const intent = { side: 'buy' as const, amountUsd: 1_000, symbol: 'NVDAx' };
    const evaluation = evaluateTrade({
      intent,
      token: { price: 100 },
      mandate: mandate(),
      portfolio: start,
      cumulativeSpentUsd: 0,
    });
    const next = applyTrade(start, intent, evaluation);
    expect(next.cashUsd).toBe(4_000);
    expect(next.positions.NVDAx).toEqual({ shares: 10, costUsd: 1_000 });
    expect(start.positions.NVDAx).toBeUndefined();
  });

  it('reduces a position and returns cash on a full sell', () => {
    const start = portfolio({ cashUsd: 1_000, positions: { NVDAx: { shares: 10, costUsd: 900 } } });
    const intent = { side: 'sell' as const, amountUsd: 1_000, symbol: 'NVDAx' };
    const evaluation = evaluateTrade({
      intent,
      token: { price: 100 },
      mandate: mandate(),
      portfolio: start,
      cumulativeSpentUsd: 0,
    });
    const next = applyTrade(start, intent, evaluation);
    expect(next.cashUsd).toBe(2_000);
    expect(next.positions.NVDAx).toBeUndefined();
  });
});
