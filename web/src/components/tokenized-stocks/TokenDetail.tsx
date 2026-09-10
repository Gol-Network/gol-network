'use client';

import { useState } from 'react';
import type { Position, StockToken } from './types';
import { AddressChip } from './AddressChip';
import { PriceChart } from './PriceChart';
import {
  CHART_RANGES,
  compact,
  compactUsd,
  pct,
  rangeSeries,
  shares as fmtShares,
  signedUsd,
  usd,
  type ChartRange,
} from './world';

interface TokenDetailProps {
  token: StockToken;
  position: Position | undefined;
  onBack: () => void;
  onTrade: (symbol: string) => void;
}

export function TokenDetail({ token, position, onBack, onTrade }: TokenDetailProps) {
  const [range, setRange] = useState<ChartRange>('30D');
  const changeUsd = (token.price * token.change24hPct) / 100;
  const rising = token.change24hPct >= 0;

  const positionValue = position ? position.shares * token.price : 0;
  const positionPnl = position ? positionValue - position.costUsd : 0;
  const positionPnlPct = position && position.costUsd > 0 ? (positionPnl / position.costUsd) * 100 : 0;

  return (
    <article className="panel token-detail" data-testid="token-detail">
      <button type="button" className="text-button back-link" onClick={onBack}>
        ← All tokens
      </button>

      <div className="panel-heading">
        <div>
          <p className="kicker">{token.underlying}</p>
          <h2>
            {token.symbol} · {token.name}
          </h2>
        </div>
        <span className={`status ${rising ? 'active' : 'refused'}`}>{pct(token.change24hPct)} 24h</span>
      </div>

      <div className="detail-price">
        <strong>{usd(token.price)}</strong>
        <span className={rising ? 'up' : 'down'}>
          {signedUsd(changeUsd)} ({pct(token.change24hPct)}) today
        </span>
      </div>

      <div className="chart-ranges">
        {CHART_RANGES.map((value) => (
          <button
            key={value}
            type="button"
            className={range === value ? 'selected' : ''}
            onClick={() => setRange(value)}
          >
            {value}
          </button>
        ))}
      </div>

      <PriceChart values={rangeSeries(token.history, range)} />

      <div className="metrics detail-metrics">
        <div>
          <span>Market cap</span>
          <strong>{compactUsd(token.marketCapUsd)}</strong>
        </div>
        <div>
          <span>24h volume</span>
          <strong>{compactUsd(token.volume24hUsd)}</strong>
        </div>
        <div>
          <span>Circ. supply</span>
          <strong>{compact(token.circulatingSupply)}</strong>
        </div>
        <div>
          <span>Day range</span>
          <strong>
            {usd(token.dayLow)} – {usd(token.dayHigh)}
          </strong>
        </div>
        <div>
          <span>Oracle</span>
          <strong>{token.oracle} (mock)</strong>
        </div>
        <div>
          <span>Issuer</span>
          <strong>{token.issuer}</strong>
        </div>
      </div>

      <div className="identities">
        <div>
          <span>Token address</span>
          <AddressChip value={token.address} />
        </div>
        <div>
          <span>Underlying</span>
          <code className="muted">{token.underlying}</code>
        </div>
        <div>
          <span>Chain</span>
          <code className="muted">Base Mainnet · eip155:8453 (mock)</code>
        </div>
        <div>
          <span>Backing</span>
          <code className="muted">1 token = 1 share, held by the issuer (mock)</code>
        </div>
      </div>

      {position ? (
        <p className="control-note">
          You hold {fmtShares(position.shares)} {token.symbol} (~{usd(positionValue)}). Cost{' '}
          {usd(position.costUsd)} · unrealized {signedUsd(positionPnl)} ({pct(positionPnlPct)}).
        </p>
      ) : (
        <p className="control-note">No open position in {token.symbol}.</p>
      )}

      <button type="button" className="primary" onClick={() => onTrade(token.symbol)}>
        Trade {token.symbol} <span>→</span>
      </button>
    </article>
  );
}
