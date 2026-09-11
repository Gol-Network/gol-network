'use client';

import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { AuditEntry, BaseMandate, MandateDraft, Portfolio, StockToken } from './types';
import type { TradeIntent } from './trade';
import { AddressChip } from './AddressChip';
import {
  AGENT_DESK_ADDRESS,
  compactUsd,
  explorerTx,
  pct,
  shares as fmtShares,
  shorten,
  signedUsd,
  usd,
} from './world';

function activate(event: KeyboardEvent, handler: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handler();
  }
}

/* -------------------------------------------------------------------------- */
/* Portfolio                                                                   */
/* -------------------------------------------------------------------------- */

interface PortfolioPanelProps {
  portfolio: Portfolio;
  tokens: StockToken[];
  onOpen: (symbol: string) => void;
}

export function PortfolioPanel({ portfolio, tokens, onOpen }: PortfolioPanelProps) {
  const priceBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const token of tokens) map.set(token.symbol, token.price);
    return map;
  }, [tokens]);

  const rows = Object.entries(portfolio.positions)
    .map(([symbol, position]) => {
      const price = priceBySymbol.get(symbol) ?? 0;
      const value = position.shares * price;
      const pnl = value - position.costUsd;
      return {
        symbol,
        shares: position.shares,
        avg: position.shares > 0 ? position.costUsd / position.shares : 0,
        value,
        pnl,
        pnlPct: position.costUsd > 0 ? (pnl / position.costUsd) * 100 : 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  const positionsValue = rows.reduce((sum, row) => sum + row.value, 0);
  const positionsCost = rows.reduce((sum, row) => sum + (row.value - row.pnl), 0);
  const totalValue = portfolio.cashUsd + positionsValue;
  const pnl = positionsValue - positionsCost;
  const pnlPct = positionsCost > 0 ? (pnl / positionsCost) * 100 : 0;

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="kicker">YOUR BOOK</p>
          <h2>Portfolio</h2>
        </div>
        <span className="agent-dot">{usd(totalValue)}</span>
      </div>

      <div className="balances">
        <div>
          <span>Total value</span>
          <strong>{usd(totalValue)}</strong>
          <small>Cash plus positions at mock marks.</small>
        </div>
        <div>
          <span>Cash (USDC)</span>
          <strong>{usd(portfolio.cashUsd)}</strong>
          <small>Available for the agent desk to deploy.</small>
        </div>
        <div>
          <span>Unrealized P/L</span>
          <strong className={pnl >= 0 ? 'up' : 'down'}>
            {signedUsd(pnl)} ({pct(pnlPct)})
          </strong>
          <small>Against blended cost basis.</small>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <strong>No open positions</strong>
          <span>Executed trades from the desk show up here.</span>
        </div>
      ) : (
        <ul className="holdings">
          {rows.map((row) => (
            <li
              key={row.symbol}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(row.symbol)}
              onKeyDown={(event) => activate(event, () => onOpen(row.symbol))}
            >
              <div>
                <strong>{row.symbol}</strong>
                <small>
                  {fmtShares(row.shares)} sh · avg {usd(row.avg)}
                </small>
              </div>
              <div className="holding-val">
                <strong>{usd(row.value)}</strong>
                <small className={row.pnl >= 0 ? 'up' : 'down'}>{pct(row.pnlPct)}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Trade console                                                               */
/* -------------------------------------------------------------------------- */

export interface TradePreview {
  intent: TradeIntent;
  token: StockToken;
}

export interface TradeStatus {
  tone: 'idle' | 'info' | 'executed' | 'refused';
  text: string;
  detail: string;
}

interface TradeConsoleProps {
  text: string;
  setText: (value: string) => void;
  examples: string[];
  preview: TradePreview | null;
  status: TradeStatus;
  canTrade: boolean;
  onPreview: (event: FormEvent) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function TradeConsole({
  text,
  setText,
  examples,
  preview,
  status,
  canTrade,
  onPreview,
  onSubmit,
  onCancel,
}: TradeConsoleProps) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="kicker">AGENT DESK</p>
          <h2>Trade instruction</h2>
        </div>
        <span className="agent-dot">Mandate-bound</span>
      </div>

      <form onSubmit={onPreview}>
        <label htmlFor="trade-instruction">Instruction</label>
        <textarea
          id="trade-instruction"
          value={text}
          maxLength={400}
          placeholder="Buy 500 USDC of NVDAx"
          onChange={(event) => setText(event.target.value)}
        />
        <div className="examples">
          {examples.map((example) => (
            <button type="button" key={example} onClick={() => setText(example)}>
              {example}
            </button>
          ))}
        </div>
        <button className="primary" type="submit" disabled={!canTrade || preview !== null}>
          Preview trade <span>→</span>
        </button>
      </form>

      {!canTrade && (
        <p className="hint">Create an active Base mandate before the desk can trade.</p>
      )}

      {preview && (
        <div className="resolved" data-testid="trade-preview">
          <span>RESOLVED BEFORE SUBMISSION</span>
          <strong>
            {preview.intent.side.toUpperCase()} {usd(preview.intent.amountUsd)}
          </strong>
          <strong>{preview.token.symbol}</strong>
          <code>
            ≈ {fmtShares(preview.intent.amountUsd / preview.token.price)} shares @{' '}
            {usd(preview.token.price)}
          </code>
          <code>{preview.token.address}</code>
          <div className="resolved-actions">
            <button className="secondary" onClick={onCancel}>
              Cancel
            </button>
            <button className="primary" onClick={onSubmit}>
              Submit trade <span>→</span>
            </button>
          </div>
        </div>
      )}

      <div
        className={`run-state trade-state ${status.tone}`}
        role="status"
        data-testid="trade-status"
      >
        <i />
        <div>
          <strong>{status.text}</strong>
          {status.detail && <span>{status.detail}</span>}
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Base mandate                                                                */
/* -------------------------------------------------------------------------- */

export interface MandateTx {
  phase: 'idle' | 'awaiting' | 'confirmed';
  hash: string | null;
  text: string;
}

interface BaseMandatePanelProps {
  mandate: BaseMandate | null;
  phase: 'none' | 'active' | 'revoked' | 'expired';
  draft: MandateDraft | null;
  busy: boolean;
  tx: MandateTx;
  tokens: StockToken[];
  spentUsd: number;
  onOpenDraft: () => void;
  onChangeDraft: (draft: MandateDraft) => void;
  onSign: () => void;
  onCancel: () => void;
  onRevoke: () => void;
}

export function BaseMandatePanel(props: BaseMandatePanelProps) {
  const { mandate, phase, draft, busy, tx, tokens, spentUsd } = props;
  const active = phase === 'active' && mandate !== null;

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="kicker">OWNER CONTROL</p>
          <h2>Base mandate</h2>
        </div>
        <span className={`status ${active ? 'active' : 'refused'}`}>
          {active ? 'Active' : 'Setup required'}
        </span>
      </div>

      {!active && !draft && (
        <>
          <p className="control-note">
            {phase === 'revoked'
              ? `Mandate #${mandate?.id} was revoked. Create a new one to let the desk trade again.`
              : phase === 'expired'
                ? `Mandate #${mandate?.id} expired. Create a new one to resume trading.`
                : 'Authorize the agent desk to trade a fixed USDC budget on Base within a per-trade cap, a cumulative cap, an allowlist of tokens, and an expiry. The owner can revoke at any time.'}
          </p>
          <button className="primary control-button" onClick={props.onOpenDraft}>
            {phase === 'none' ? 'Create mandate on Base' : 'Create new mandate'} <span>→</span>
          </button>
        </>
      )}

      {draft && (
        <MandateDraftForm
          draft={draft}
          tokens={tokens}
          busy={busy}
          onChange={props.onChangeDraft}
          onCancel={props.onCancel}
          onSign={props.onSign}
        />
      )}

      {tx.phase !== 'idle' && (
        <div
          className={`tx-status ${tx.phase === 'confirmed' ? 'confirmed' : ''}`}
          role="status"
          data-testid="mandate-tx"
        >
          <strong>
            {tx.phase === 'awaiting'
              ? 'Awaiting your Base wallet signature'
              : 'Mandate confirmed on Base (mock)'}
          </strong>
          {tx.text && <span>{tx.text}</span>}
          {tx.hash && (
            <a href={explorerTx(tx.hash)} target="_blank" rel="noreferrer">
              {shorten(tx.hash)} ↗
            </a>
          )}
        </div>
      )}

      {active && mandate && (
        <>
          <div className="identities">
            <div>
              <span>Mandate</span>
              <strong>#{mandate.id} active</strong>
            </div>
            <div>
              <span>Agent desk</span>
              <AddressChip value={mandate.agent} />
            </div>
            <div>
              <span>Allowed tokens</span>
              <code className="muted">
                {mandate.allowedSymbols === 'all'
                  ? 'All listed tokens'
                  : mandate.allowedSymbols.join(', ')}
              </code>
            </div>
            <div>
              <span>Expires</span>
              <code className="muted">
                {new Date(mandate.expiresAt * 1000).toLocaleString('en-US')}
              </code>
            </div>
          </div>
          <div className="metrics">
            <div>
              <span>Per trade</span>
              <strong>{usd(mandate.perTradeCapUsd)}</strong>
            </div>
            <div>
              <span>Cumulative</span>
              <strong>{usd(mandate.cumulativeCapUsd)}</strong>
            </div>
            <div>
              <span>Remaining</span>
              <strong className="coral">
                {usd(Math.max(0, mandate.cumulativeCapUsd - spentUsd))}
              </strong>
            </div>
          </div>
          <div className="owner-actions">
            <button className="secondary" onClick={props.onRevoke}>
              Revoke mandate
            </button>
          </div>
          <p className="hint">
            The immutable policy decides every trade. The owner can revoke from here at any time.
          </p>
        </>
      )}
    </article>
  );
}

interface MandateDraftFormProps {
  draft: MandateDraft;
  tokens: StockToken[];
  busy: boolean;
  onChange: (draft: MandateDraft) => void;
  onCancel: () => void;
  onSign: () => void;
}

function MandateDraftForm({
  draft,
  tokens,
  busy,
  onChange,
  onCancel,
  onSign,
}: MandateDraftFormProps) {
  const [perTrade, setPerTrade] = useState(String(draft.perTradeCapUsd));
  const [cumulative, setCumulative] = useState(String(draft.cumulativeCapUsd));
  const [error, setError] = useState<string | null>(null);

  function commitCaps(nextPerTrade: string, nextCumulative: string) {
    setPerTrade(nextPerTrade);
    setCumulative(nextCumulative);
    const perTradeUsd = Number(nextPerTrade.replace(/,/g, ''));
    const cumulativeUsd = Number(nextCumulative.replace(/,/g, ''));
    if (
      !Number.isFinite(perTradeUsd) ||
      !Number.isFinite(cumulativeUsd) ||
      perTradeUsd <= 0 ||
      cumulativeUsd <= 0
    ) {
      setError('Use positive USDC amounts.');
      return;
    }
    if (perTradeUsd > cumulativeUsd) {
      setError('The per-trade cap cannot exceed the cumulative cap.');
      return;
    }
    setError(null);
    onChange({ ...draft, perTradeCapUsd: perTradeUsd, cumulativeCapUsd: cumulativeUsd });
  }

  function toggleAll() {
    onChange({
      ...draft,
      allowedSymbols:
        draft.allowedSymbols === 'all' ? tokens.slice(0, 3).map((token) => token.symbol) : 'all',
    });
  }

  function toggleSymbol(symbol: string) {
    if (draft.allowedSymbols === 'all') {
      onChange({ ...draft, allowedSymbols: [symbol] });
      return;
    }
    const has = draft.allowedSymbols.includes(symbol);
    const next = has
      ? draft.allowedSymbols.filter((entry) => entry !== symbol)
      : [...draft.allowedSymbols, symbol];
    onChange({ ...draft, allowedSymbols: next.length === 0 ? 'all' : next });
  }

  const expires = new Date(Date.now() + draft.expiresInDays * 86_400_000);

  return (
    <div className="review" data-testid="mandate-review">
      <p className="kicker">REVIEW BEFORE SIGNATURE</p>
      <dl>
        <dt>Agent desk</dt>
        <dd>
          <code>{AGENT_DESK_ADDRESS}</code>
        </dd>
        <dt>Per-trade cap</dt>
        <dd>
          <input
            aria-label="Per-trade cap (USDC)"
            className="setup-input compact-input"
            inputMode="decimal"
            value={perTrade}
            onChange={(event) => commitCaps(event.target.value, cumulative)}
          />
        </dd>
        <dt>Cumulative cap</dt>
        <dd>
          <input
            aria-label="Cumulative cap (USDC)"
            className="setup-input compact-input"
            inputMode="decimal"
            value={cumulative}
            onChange={(event) => commitCaps(perTrade, event.target.value)}
          />
        </dd>
        <dt>Allowed tokens</dt>
        <dd>
          <div className="token-allowlist">
            <button
              type="button"
              className={draft.allowedSymbols === 'all' ? 'selected' : ''}
              onClick={toggleAll}
            >
              All listed
            </button>
            {tokens.map((token) => {
              const selected =
                draft.allowedSymbols !== 'all' && draft.allowedSymbols.includes(token.symbol);
              return (
                <button
                  key={token.symbol}
                  type="button"
                  className={selected ? 'selected' : ''}
                  onClick={() => toggleSymbol(token.symbol)}
                >
                  {token.symbol}
                </button>
              );
            })}
          </div>
        </dd>
        <dt>Expiry</dt>
        <dd>
          {draft.expiresInDays} days · {expires.toLocaleDateString('en-US')}
        </dd>
        <dt>Chain</dt>
        <dd>Base Mainnet · eip155:8453 (mock)</dd>
      </dl>
      {error && <p className="dialog-error">{error}</p>}
      <div className="review-actions">
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" onClick={onSign} disabled={busy || error !== null}>
          Sign mandate <span>→</span>
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                   */
/* -------------------------------------------------------------------------- */

type AuditFilter = 'ALL' | 'EXECUTED' | 'REFUSED';

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  const [filter, setFilter] = useState<AuditFilter>('ALL');
  const visible = filter === 'ALL' ? entries : entries.filter((entry) => entry.outcome === filter);

  return (
    <article className="panel">
      <div className="panel-heading timeline-heading">
        <div>
          <p className="kicker">RECORD</p>
          <h2>Audit log</h2>
        </div>
        <div className="filters">
          {(['ALL', 'EXECUTED', 'REFUSED'] as const).map((value) => (
            <button
              key={value}
              className={filter === value ? 'selected' : ''}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="freshness" role="status">
        <i />
        <span className="freshness-badge">MOCK LEDGER</span>
        <span>
          {entries.length} record{entries.length === 1 ? '' : 's'} · resets on reload
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <strong>No trades yet</strong>
          <span>Approved and refused trades are both recorded here.</span>
        </div>
      ) : (
        <ol className="timeline">
          {visible.map((entry) => (
            <li key={entry.id}>
              <span className={`event-icon ${entry.outcome.toLowerCase()}`}>
                {entry.outcome === 'EXECUTED' ? '✓' : '!'}
              </span>
              <div className="event-main">
                <div>
                  <strong>
                    {entry.side.toUpperCase()} {usd(entry.amountUsd)} {entry.symbol}
                  </strong>
                  <span className={`status ${entry.outcome.toLowerCase()}`}>{entry.outcome}</span>
                </div>
                <p>
                  {entry.outcome === 'REFUSED'
                    ? `Recorded refusal · ${entry.rule}`
                    : `Filled ${fmtShares(entry.shares)} sh @ ${usd(entry.price)}`}
                </p>
                <small>
                  Trade {shorten(entry.id)} ·{' '}
                  {entry.mandateId !== null ? `Mandate #${entry.mandateId}` : 'no mandate'} ·{' '}
                  <a href={explorerTx(entry.txHash)} target="_blank" rel="noreferrer">
                    transaction ↗
                  </a>
                </small>
              </div>
              <div className="headroom">
                <span>HEADROOM</span>
                <strong>{compactUsd(entry.headroomUsd)}</strong>
                <small>USDC</small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
