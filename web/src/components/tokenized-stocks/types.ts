/**
 * Types for the Tokenized Stocks tab. This whole module is a labeled mock built for the Base
 * hackathon: no wallet, chain, price feed, or order here is real, and every value is regenerated
 * from scratch on reload. It deliberately mirrors the Arc testnet shapes (mandate, per-trade and
 * cumulative caps, recorded refusals) so the two tabs read the same way.
 */

export type Hex = `0x${string}`;

export interface StockToken {
  /** Tokenized ticker, e.g. `NVDAx`. */
  symbol: string;
  /** Display name, e.g. `Tokenized NVIDIA`. */
  name: string;
  /** Underlying equity line, e.g. `NVDA · NVIDIA Corp.`. */
  underlying: string;
  address: Hex;
  issuer: string;
  oracle: 'Chainlink' | 'Pyth';
  price: number;
  change24hPct: number;
  dayLow: number;
  dayHigh: number;
  marketCapUsd: number;
  volume24hUsd: number;
  circulatingSupply: number;
  /** 90 daily closes, oldest first. The last point is the current mark. */
  history: number[];
}

export interface Position {
  shares: number;
  /** Blended cost basis in USDC for the held shares. */
  costUsd: number;
}

export interface Portfolio {
  cashUsd: number;
  positions: Record<string, Position>;
}

export interface MockWorld {
  tokens: StockToken[];
  portfolio: Portfolio;
  seededAt: number;
}

export type AllowedSymbols = 'all' | string[];

export interface BaseMandate {
  id: number;
  agent: Hex;
  perTradeCapUsd: number;
  cumulativeCapUsd: number;
  allowedSymbols: AllowedSymbols;
  /** Epoch seconds. */
  expiresAt: number;
  /** Epoch seconds. */
  createdAt: number;
  revoked: boolean;
  txHash: Hex;
}

export interface MandateDraft {
  perTradeCapUsd: number;
  cumulativeCapUsd: number;
  allowedSymbols: AllowedSymbols;
  expiresInDays: number;
}

export interface AuditEntry {
  id: Hex;
  at: number;
  side: 'buy' | 'sell';
  symbol: string;
  amountUsd: number;
  outcome: 'EXECUTED' | 'REFUSED';
  rule: string;
  headroomUsd: number;
  shares: number;
  price: number;
  mandateId: number | null;
  txHash: Hex;
}
