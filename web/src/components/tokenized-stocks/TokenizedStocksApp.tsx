'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { AuditEntry, BaseMandate, MandateDraft, MockWorld, Portfolio } from './types';
import { applyTrade, evaluateTrade, parseTrade } from './trade';
import { AGENT_DESK_ADDRESS, createMockWorld, randomTxHash, usd } from './world';
import { StockTable } from './StockTable';
import { TokenDetail } from './TokenDetail';
import {
  AuditLog,
  BaseMandatePanel,
  PortfolioPanel,
  TradeConsole,
  type MandateTx,
  type TradePreview,
  type TradeStatus,
} from './panels';

const TRADE_EXAMPLES = [
  'Buy 500 USDC of NVDAx',
  'Trade 250 USDC into TSLAx',
  'Sell 100 USDC of AAPLx',
];

const IDLE_STATUS: TradeStatus = {
  tone: 'idle',
  text: 'Awaiting a trade instruction.',
  detail: '',
};

const IDLE_TX: MandateTx = { phase: 'idle', hash: null, text: '' };

/**
 * The Tokenized Stocks tab. Everything under here is an explicitly labeled mock for the Base
 * hackathon: the market, portfolio, mandate, and audit log all live in memory and are rebuilt on
 * every mount, so a reload wipes the slate. It mirrors the Arc testnet tab's structure — a
 * mandate with caps and an allowlist, a bounded instruction resolved before submission, and an
 * audit log that records approvals and refusals alike.
 */
export function TokenizedStocksApp() {
  const [world, setWorld] = useState<MockWorld | null>(null);

  // Build the random world on the client only, so the server-rendered shell and the hydrated app
  // never disagree, and every reload gets a fresh market.
  useEffect(() => {
    setWorld(createMockWorld());
  }, []);

  if (!world) {
    return (
      <main className="stocks-boot">
        <p className="eyebrow">TOKENIZED EQUITIES · BASE</p>
        <p>Preparing the mock market…</p>
      </main>
    );
  }
  return <TokenizedStocksExperience world={world} onReset={() => setWorld(createMockWorld())} />;
}

type View = { name: 'list' } | { name: 'detail'; symbol: string };

function TokenizedStocksExperience({
  world,
  onReset,
}: {
  world: MockWorld;
  onReset: () => void;
}) {
  const tokens = world.tokens;
  const [portfolio, setPortfolio] = useState<Portfolio>(world.portfolio);
  const [mandate, setMandate] = useState<BaseMandate | null>(null);
  const [cumulativeSpentUsd, setCumulativeSpentUsd] = useState(0);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const [view, setView] = useState<View>({ name: 'list' });
  const [tradeText, setTradeText] = useState('');
  const [tradePreview, setTradePreview] = useState<TradePreview | null>(null);
  const [tradeStatus, setTradeStatus] = useState<TradeStatus>(IDLE_STATUS);

  const [mandateDraft, setMandateDraft] = useState<MandateDraft | null>(null);
  const [mandateBusy, setMandateBusy] = useState(false);
  const [mandateTx, setMandateTx] = useState<MandateTx>(IDLE_TX);

  const tokenBySymbol = useMemo(() => {
    const map = new Map<string, (typeof tokens)[number]>();
    for (const token of tokens) map.set(token.symbol, token);
    return map;
  }, [tokens]);

  const mandatePhase: 'none' | 'active' | 'revoked' | 'expired' = !mandate
    ? 'none'
    : mandate.revoked
      ? 'revoked'
      : mandate.expiresAt * 1000 < Date.now()
        ? 'expired'
        : 'active';
  const canTrade = mandatePhase === 'active';

  const portfolioValue = useMemo(() => {
    let value = portfolio.cashUsd;
    for (const [symbol, position] of Object.entries(portfolio.positions)) {
      value += position.shares * (tokenBySymbol.get(symbol)?.price ?? 0);
    }
    return value;
  }, [portfolio, tokenBySymbol]);

  const openDetail = useCallback((symbol: string) => setView({ name: 'detail', symbol }), []);
  const backToList = useCallback(() => setView({ name: 'list' }), []);

  const prefillTrade = useCallback((symbol: string) => {
    setTradeText(`Buy 500 USDC of ${symbol}`);
    setTradePreview(null);
    setTradeStatus(IDLE_STATUS);
    setView({ name: 'list' });
    if (typeof document !== 'undefined') {
      document.getElementById('trade-instruction')?.scrollIntoView({ block: 'center' });
    }
  }, []);

  const onPreview = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const parsed = parseTrade(tradeText, tokens);
      if (parsed.kind === 'clarification') {
        setTradePreview(null);
        setTradeStatus({ tone: 'info', text: 'Needs clarification', detail: parsed.message });
        return;
      }
      const token = tokenBySymbol.get(parsed.intent.symbol);
      if (!token) {
        setTradePreview(null);
        setTradeStatus({
          tone: 'info',
          text: 'Needs clarification',
          detail: 'That token is not listed.',
        });
        return;
      }
      setTradePreview({ intent: parsed.intent, token });
      setTradeStatus(IDLE_STATUS);
    },
    [tradeText, tokens, tokenBySymbol],
  );

  const onSubmitTrade = useCallback(() => {
    if (!tradePreview) return;
    const { intent, token } = tradePreview;
    const evaluation = evaluateTrade({
      intent,
      token,
      mandate,
      portfolio,
      cumulativeSpentUsd,
    });

    const entry: AuditEntry = {
      id: randomTxHash(),
      at: Date.now(),
      side: intent.side,
      symbol: intent.symbol,
      amountUsd: intent.amountUsd,
      outcome: evaluation.outcome,
      rule: evaluation.rule,
      headroomUsd: evaluation.headroomUsd,
      shares: evaluation.shares,
      price: evaluation.price,
      mandateId: mandate?.id ?? null,
      txHash: randomTxHash(),
    };
    setAudit((current) => [entry, ...current]);

    if (evaluation.outcome === 'EXECUTED') {
      setPortfolio((current) => applyTrade(current, intent, evaluation));
      if (intent.side === 'buy') {
        setCumulativeSpentUsd((current) => current + intent.amountUsd);
      }
      setTradeStatus({
        tone: 'executed',
        text: `EXECUTED · ${intent.side.toUpperCase()} ${usd(intent.amountUsd)} ${intent.symbol}`,
        detail: `${evaluation.detail} ${usd(evaluation.headroomUsd)} cumulative headroom left.`,
      });
    } else {
      setTradeStatus({
        tone: 'refused',
        text: `REFUSED · ${evaluation.rule}`,
        detail: evaluation.detail,
      });
    }
    setTradePreview(null);
    setTradeText('');
  }, [tradePreview, mandate, portfolio, cumulativeSpentUsd]);

  const openMandateDraft = useCallback(() => {
    setMandateDraft({
      perTradeCapUsd: 2_000,
      cumulativeCapUsd: 10_000,
      allowedSymbols: 'all',
      expiresInDays: 7,
    });
    setMandateTx(IDLE_TX);
  }, []);

  const signMandate = useCallback(() => {
    if (!mandateDraft) return;
    setMandateBusy(true);
    setMandateTx({
      phase: 'awaiting',
      hash: null,
      text: 'Confirm the mandate in your Base wallet (mock).',
    });
    const draft = mandateDraft;
    window.setTimeout(() => {
      const hash = randomTxHash();
      const now = Math.floor(Date.now() / 1000);
      setMandate((previous) => ({
        id: (previous?.id ?? 0) + 1,
        agent: AGENT_DESK_ADDRESS,
        perTradeCapUsd: draft.perTradeCapUsd,
        cumulativeCapUsd: draft.cumulativeCapUsd,
        allowedSymbols: draft.allowedSymbols,
        expiresAt: now + draft.expiresInDays * 86_400,
        createdAt: now,
        revoked: false,
        txHash: hash,
      }));
      setCumulativeSpentUsd(0);
      setMandateDraft(null);
      setMandateBusy(false);
      setMandateTx({ phase: 'confirmed', hash, text: 'The agent desk can now trade within its caps.' });
    }, 600);
  }, [mandateDraft]);

  const revokeMandate = useCallback(() => {
    setMandate((current) => (current ? { ...current, revoked: true } : current));
    setMandateTx(IDLE_TX);
  }, []);

  const detailToken = view.name === 'detail' ? tokenBySymbol.get(view.symbol) : undefined;
  const mandateLabel =
    mandatePhase === 'active' && mandate
      ? `#${mandate.id} · ${usd(Math.max(0, mandate.cumulativeCapUsd - cumulativeSpentUsd))} left`
      : mandatePhase === 'revoked'
        ? 'Revoked'
        : mandatePhase === 'expired'
          ? 'Expired'
          : 'Not set';

  return (
    <main id="top">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">G</span>
          <span>GOL</span>
        </a>
        <div className="top-actions">
          <span className="network">
            <i /> Base · Mock
          </span>
          <button className="ghost" onClick={onReset} type="button">
            Reset mock data
          </button>
        </div>
      </header>

      <p className="mode-banner fixture" role="status">
        <strong>MOCK UI</strong>
        <span>
          Base hackathon demo. No wallet, chain, price feed, or order here is real, and every value
          regenerates on reload.
        </span>
      </p>

      <section className="hero">
        <div>
          <p className="eyebrow">TOKENIZED EQUITIES · BASE</p>
          <h1>
            Trade tokenized stocks.
            <br />
            <em>Inside a mandate.</em>
          </h1>
          <p className="lede">
            A mock desk for tokenized equities on Base: browse the tokens, hold a portfolio, and let
            an agent trade a budget you set. Every approval and every refusal is recorded.
          </p>
        </div>
        <div className="hero-proof">
          <div>
            <span>Portfolio</span>
            <strong>{usd(portfolioValue)}</strong>
          </div>
          <div>
            <span>Cash</span>
            <strong>{usd(portfolio.cashUsd)}</strong>
          </div>
          <div>
            <span>Mandate</span>
            <strong className="coral">{mandateLabel}</strong>
          </div>
        </div>
      </section>

      <section className="grid primary-grid">
        {view.name === 'detail' && detailToken ? (
          <TokenDetail
            token={detailToken}
            position={portfolio.positions[detailToken.symbol]}
            onBack={backToList}
            onTrade={prefillTrade}
          />
        ) : (
          <StockTable tokens={tokens} positions={portfolio.positions} onOpen={openDetail} />
        )}

        <div className="stack">
          <PortfolioPanel portfolio={portfolio} tokens={tokens} onOpen={openDetail} />
          <TradeConsole
            text={tradeText}
            setText={setTradeText}
            examples={TRADE_EXAMPLES}
            preview={tradePreview}
            status={tradeStatus}
            canTrade={canTrade}
            onPreview={onPreview}
            onSubmit={onSubmitTrade}
            onCancel={() => setTradePreview(null)}
          />
          <BaseMandatePanel
            mandate={mandate}
            phase={mandatePhase}
            draft={mandateDraft}
            busy={mandateBusy}
            tx={mandateTx}
            tokens={tokens}
            spentUsd={cumulativeSpentUsd}
            onOpenDraft={openMandateDraft}
            onChangeDraft={setMandateDraft}
            onSign={signMandate}
            onCancel={() => {
              setMandateDraft(null);
              setMandateTx(IDLE_TX);
            }}
            onRevoke={revokeMandate}
          />
        </div>
      </section>

      <section className="grid audit-section">
        <AuditLog entries={audit} />
      </section>

      <footer>
        <span>GOL · BASE · MOCK UI</span>
        <span>Tokenized equities · Mandate-enforced trades · Recorded refusals</span>
      </footer>
    </main>
  );
}
