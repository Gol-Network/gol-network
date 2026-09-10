import type { Hex, MockWorld, Portfolio, StockToken } from './types';

/**
 * Seeded pseudo-random world builder for the Tokenized Stocks tab. The seed is drawn from the
 * clock at build time, so every reload produces a fresh-but-coherent market. Nothing is persisted.
 */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
}

function createRng(seed: string): Rng {
  const seeder = xmur3(seed);
  const rand = mulberry32(seeder());
  const range = (min: number, max: number) => min + (max - min) * rand();
  return {
    next: rand,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    pick: (values) => values[Math.floor(rand() * values.length)] as (typeof values)[number],
  };
}

function hex(rng: Rng, bytes: number): Hex {
  let out = '0x';
  for (let i = 0; i < bytes * 2; i += 1) out += Math.floor(rng.next() * 16).toString(16);
  return out as Hex;
}

interface Catalog {
  symbol: string;
  name: string;
  underlying: string;
  basePrice: number;
  supply: number;
}

const CATALOG: Catalog[] = [
  { symbol: 'AAPLx', name: 'Tokenized Apple', underlying: 'AAPL · Apple Inc.', basePrice: 229, supply: 5_400_000 },
  { symbol: 'NVDAx', name: 'Tokenized NVIDIA', underlying: 'NVDA · NVIDIA Corp.', basePrice: 122, supply: 9_100_000 },
  { symbol: 'TSLAx', name: 'Tokenized Tesla', underlying: 'TSLA · Tesla Inc.', basePrice: 247, supply: 4_200_000 },
  { symbol: 'MSFTx', name: 'Tokenized Microsoft', underlying: 'MSFT · Microsoft Corp.', basePrice: 421, supply: 3_050_000 },
  { symbol: 'GOOGLx', name: 'Tokenized Alphabet', underlying: 'GOOGL · Alphabet Inc.', basePrice: 168, supply: 3_700_000 },
  { symbol: 'AMZNx', name: 'Tokenized Amazon', underlying: 'AMZN · Amazon.com Inc.', basePrice: 186, supply: 3_400_000 },
  { symbol: 'METAx', name: 'Tokenized Meta', underlying: 'META · Meta Platforms Inc.', basePrice: 563, supply: 1_450_000 },
  { symbol: 'COINx', name: 'Tokenized Coinbase', underlying: 'COIN · Coinbase Global Inc.', basePrice: 232, supply: 980_000 },
  { symbol: 'MSTRx', name: 'Tokenized Strategy', underlying: 'MSTR · Strategy Inc.', basePrice: 178, supply: 1_120_000 },
  { symbol: 'SPYx', name: 'Tokenized S&P 500', underlying: 'SPY · SPDR S&P 500 ETF', basePrice: 566, supply: 2_600_000 },
];

const HISTORY_DAYS = 90;

function buildHistory(rng: Rng, basePrice: number): number[] {
  const drift = rng.range(-0.28, 0.32);
  let price = basePrice * (1 - drift);
  const points: number[] = [];
  for (let day = 0; day < HISTORY_DAYS; day += 1) {
    const pull = ((basePrice - price) / basePrice) * 0.05;
    const shock = rng.range(-0.028, 0.028);
    price = Math.max(basePrice * 0.25, price * (1 + pull + shock));
    points.push(round(price, 2));
  }
  return points;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildToken(rng: Rng, entry: Catalog): StockToken {
  const history = buildHistory(rng, entry.basePrice);
  const price = history[history.length - 1] ?? entry.basePrice;
  const prev = history[history.length - 2] ?? price;
  const change24hPct = round(((price - prev) / prev) * 100, 2);
  const intraday = price * rng.range(0.004, 0.021);
  return {
    symbol: entry.symbol,
    name: entry.name,
    underlying: entry.underlying,
    address: hex(rng, 20),
    issuer: 'Backed Finance xStock (mock)',
    oracle: rng.next() > 0.5 ? 'Chainlink' : 'Pyth',
    price,
    change24hPct,
    dayLow: round(price - intraday * rng.range(0.3, 1), 2),
    dayHigh: round(price + intraday * rng.range(0.3, 1), 2),
    marketCapUsd: round(price * entry.supply, 0),
    volume24hUsd: round(price * entry.supply * rng.range(0.004, 0.03), 0),
    circulatingSupply: entry.supply,
    history,
  };
}

function buildPortfolio(rng: Rng, tokens: StockToken[]): Portfolio {
  const positions: Portfolio['positions'] = {};
  const holdCount = rng.int(2, 3);
  const shuffled = [...tokens].sort(() => rng.next() - 0.5).slice(0, holdCount);
  for (const token of shuffled) {
    const value = rng.range(1_600, 4_200);
    const shares = round(value / token.price, 4);
    const costPrice = token.price * rng.range(0.82, 1.12);
    positions[token.symbol] = { shares, costUsd: round(shares * costPrice, 2) };
  }
  return { cashUsd: 25_000, positions };
}

export function createMockWorld(): MockWorld {
  const seededAt = Date.now();
  const rng = createRng(`${seededAt}:${Math.random()}`);
  const tokens = CATALOG.map((entry) => buildToken(rng, entry));
  return { tokens, portfolio: buildPortfolio(rng, tokens), seededAt };
}

/** Stable mock agent-desk address for the Base mandate review. */
export const AGENT_DESK_ADDRESS = '0xA6e17DE5c0FFEe0000000000000000000000B45E' as Hex;

export const BASESCAN_URL = 'https://basescan.org';

export function explorerAddress(address: string): string {
  return `${BASESCAN_URL}/address/${address}`;
}

export function explorerTx(hash: string): string {
  return `${BASESCAN_URL}/tx/${hash}`;
}

export function randomTxHash(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}` as Hex;
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function usd(value: number): string {
  return USD.format(value);
}

export function signedUsd(value: number): string {
  return `${value < 0 ? '−' : '+'}${USD.format(Math.abs(value))}`;
}

export function pct(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`;
}

export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${round(value / 1e9, 2)}B`;
  if (abs >= 1e6) return `${round(value / 1e6, 2)}M`;
  if (abs >= 1e3) return `${round(value / 1e3, 1)}K`;
  return `${round(value, 0)}`;
}

export function compactUsd(value: number): string {
  return `$${compact(value)}`;
}

export function shares(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function shorten(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

export const CHART_RANGES = ['24H', '7D', '30D', '90D'] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

/**
 * The price series to plot for a given range. Daily closes are sliced directly for 7D/30D/90D;
 * 24H is a deterministic intraday interpolation between the last two closes so the shortest range
 * still has shape. No randomness is used here, so the same history always yields the same chart.
 */
export function rangeSeries(history: number[], range: ChartRange): number[] {
  if (history.length === 0) return [];
  if (range === '24H') {
    const end = history[history.length - 1] ?? 0;
    const start = history[history.length - 2] ?? end;
    const steps = 24;
    const series: number[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const wobble = Math.sin(i * 1.7) * (end - start || end * 0.01) * 0.18;
      series.push(round(start + (end - start) * t + wobble, 2));
    }
    return series;
  }
  const counts: Record<Exclude<ChartRange, '24H'>, number> = {
    '7D': 7,
    '30D': 30,
    '90D': HISTORY_DAYS,
  };
  return history.slice(-counts[range]);
}
