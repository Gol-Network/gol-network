'use client';

import type { KeyboardEvent } from 'react';
import type { Portfolio, StockToken } from './types';
import { PriceChart } from './PriceChart';
import { compactUsd, pct, shares, usd } from './world';

interface StockTableProps {
  tokens: StockToken[];
  positions: Portfolio['positions'];
  onOpen: (symbol: string) => void;
}

function activate(event: KeyboardEvent, handler: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handler();
  }
}

export function StockTable({ tokens, positions, onOpen }: StockTableProps) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="kicker">BASE · TOKENIZED EQUITIES</p>
          <h2>Stock tokens</h2>
        </div>
        <span className="agent-dot">{tokens.length} listed</span>
      </div>

      <div className="stock-table-wrap">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Token</th>
              <th className="num">Price</th>
              <th className="num">24h</th>
              <th className="col-trend">Trend</th>
              <th className="num col-wide">Mkt cap</th>
              <th className="num col-wide">24h vol</th>
              <th className="num">Held</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => {
              const held = positions[token.symbol];
              return (
                <tr
                  key={token.symbol}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(token.symbol)}
                  onKeyDown={(event) => activate(event, () => onOpen(token.symbol))}
                >
                  <td>
                    <div className="stock-id">
                      <span className="stock-badge">{token.symbol.replace(/x$/, '')}</span>
                      <div>
                        <strong>{token.symbol}</strong>
                        <small>{token.name}</small>
                      </div>
                    </div>
                  </td>
                  <td className="num">{usd(token.price)}</td>
                  <td className={`num ${token.change24hPct >= 0 ? 'up' : 'down'}`}>
                    {pct(token.change24hPct)}
                  </td>
                  <td className="col-trend">
                    <span className="row-spark">
                      <PriceChart values={token.history.slice(-30)} variant="spark" />
                    </span>
                  </td>
                  <td className="num col-wide">{compactUsd(token.marketCapUsd)}</td>
                  <td className="num col-wide">{compactUsd(token.volume24hUsd)}</td>
                  <td className="num">{held ? `${shares(held.shares)}` : '—'}</td>
                  <td className="chev" aria-hidden="true">
                    →
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">Mock quotes, regenerated on reload. Select a row for the token detail view.</p>
    </article>
  );
}
