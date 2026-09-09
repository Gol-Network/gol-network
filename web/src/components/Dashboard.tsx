'use client';

import { formatNativeGas, formatUsdc, type ActivityPage, type GroundedAnswer } from '@gol/protocol';
import { useMemo, useState, type FormEvent } from 'react';
import { explorerAddressUrl, explorerTxUrl, type PublicConfig } from '@/config';
import { PAYMENT_STAGES, TRANSACTION_PHASES } from '@/client/stages';
import {
  filterTimeline,
  mergeTimeline,
  type PendingActivity,
  type TimelineFilter,
} from '@/client/timeline';
import type {
  AccountSnapshot,
  AuthState,
  InstructionPreview,
  MandateDraft,
  OwnerActionKind,
  TransactionState,
} from '@/client/types';
import type { PaymentView } from './GolApp';
import { nextIncompleteStep, type SetupStep } from './setup-steps';

export interface TransferReview {
  kind: 'fund_agent_gas' | 'fund_account';
  title: string;
  destination: string;
  destinationLabel: string;
  amountUnits: string;
  note: string;
}

export interface DashboardProps {
  config: PublicConfig;
  auth: AuthState;
  account: AccountSnapshot | null;
  accountError: string | null;
  steps: SetupStep[];
  tx: TransactionState;
  busy: OwnerActionKind | null;
  recipientInput: string;
  setRecipientInput: (value: string) => void;
  consentOpen: boolean;
  setConsentOpen: (value: boolean) => void;
  mandateReview: MandateDraft | null;
  setMandateReview: (value: MandateDraft | null) => void;
  onCreateAccount: () => void;
  onProvisionAgent: () => void;
  onReviewAgentGas: () => void;
  onReviewAccountFunding: () => void;
  transferReview: TransferReview | null;
  setTransferReview: (value: TransferReview | null) => void;
  onConfirmTransfer: () => void;
  onReviewMandate: () => void;
  onSignMandate: () => void;
  onRevoke: () => void;
  onWithdraw: () => void;
  instruction: string;
  setInstruction: (value: string) => void;
  preview: InstructionPreview | null;
  onPreview: (event: FormEvent) => void;
  onSubmitInstruction: () => void;
  onCancelPreview: () => void;
  payment: PaymentView;
  page: ActivityPage | null;
  lastGoodPage: ActivityPage | null;
  pending: PendingActivity[];
  indexingWindowClosed: boolean;
  checkingIndexing: boolean;
  onCheckIndexing: () => void;
  question: string;
  setQuestion: (value: string) => void;
  onAsk: (event: FormEvent) => void;
  answer: GroundedAnswer | null;
  asking: boolean;
}

export function Dashboard(props: DashboardProps) {
  const { config, account } = props;
  const [filter, setFilter] = useState<TimelineFilter>('ALL');
  const mandate = account?.mandate ?? null;
  const cap = mandate?.cumulativeCapUnits ?? config.accountTargetUnits;
  const spent = mandate?.spentUnits ?? '0';
  const remaining = BigInt(cap) - BigInt(spent);
  const next = nextIncompleteStep(props.steps);

  const source =
    props.page && props.page.freshness !== 'unavailable' ? props.page : props.lastGoodPage;
  const entries = useMemo(
    () => mergeTimeline(source?.records ?? [], props.pending),
    [source, props.pending],
  );
  const visible = useMemo(() => filterTimeline(entries, filter), [entries, filter]);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">G</span>
          <span>GOL</span>
        </a>
        <div className="top-actions">
          <span className="network">
            <i /> {config.chainName}
          </span>
          {!props.auth.ready ? (
            <button className="ghost" disabled>
              Initializing
            </button>
          ) : props.auth.authenticated ? (
            <button className="ghost" onClick={() => props.auth.logout()}>
              {props.auth.label} · Sign out
            </button>
          ) : (
            <button className="ghost" onClick={() => props.auth.login()}>
              {props.auth.label}
            </button>
          )}
        </div>
      </header>

      <p className={`mode-banner ${config.mode}`} role="status">
        <strong>{config.mode === 'live' ? 'LIVE PROVIDERS' : 'FIXTURE MODE'}</strong>
        <span>
          {config.mode === 'live'
            ? 'Every result below comes from Arc testnet, the configured signer, and the indexed subgraph.'
            : 'Simulated provider responses. Nothing here is a chain, signer, or model result, and it is never evidence.'}
        </span>
      </p>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">CONTROLLED AGENT PAYMENTS</p>
          <h1>
            Give the agent a budget.
            <br />
            <em>Keep the authority.</em>
          </h1>
          <p className="lede">
            A USDC account that pays approved contractors, refuses policy breaches on-chain, and
            explains every outcome with indexed evidence.
          </p>
        </div>
        <div className="hero-proof">
          <div>
            <span>Mandate</span>
            <strong>
              {account && account.activeMandateId !== '0'
                ? `#${account.activeMandateId} active`
                : 'Not active'}
            </strong>
          </div>
          <div>
            <span>Spent</span>
            <strong>{formatUsdc(BigInt(spent))} USDC</strong>
          </div>
          <div>
            <span>Remaining</span>
            <strong className="coral">{formatUsdc(remaining)} USDC</strong>
          </div>
        </div>
      </section>

      <section className="grid primary-grid">
        <article className="panel mandate-panel">
          <div className="panel-heading">
            <div>
              <p className="kicker">OWNER CONTROL</p>
              <h2>{mandate && !mandate.revoked ? 'Active mandate' : 'Owner setup'}</h2>
            </div>
            <span className={`status ${mandate && !mandate.revoked ? 'active' : 'refused'}`}>
              {mandate && !mandate.revoked ? 'Active' : 'Setup required'}
            </span>
          </div>

          <SetupChecklist
            steps={props.steps}
            busy={props.busy}
            next={next}
            config={config}
            onAction={(action) => {
              if (action === 'create_account') props.onCreateAccount();
              if (action === 'provision_agent') props.setConsentOpen(true);
              if (action === 'fund_agent_gas') props.onReviewAgentGas();
              if (action === 'fund_account') props.onReviewAccountFunding();
              if (action === 'sign_mandate') props.onReviewMandate();
            }}
          />

          {props.consentOpen && (
            <ConsentPanel
              config={config}
              account={account}
              recipientInput={props.recipientInput}
              setRecipientInput={props.setRecipientInput}
              onCancel={() => props.setConsentOpen(false)}
              onConfirm={props.onProvisionAgent}
              disabled={props.busy !== null}
            />
          )}

          {props.transferReview && (
            <TransferReviewPanel
              review={props.transferReview}
              onCancel={() => props.setTransferReview(null)}
              onConfirm={props.onConfirmTransfer}
              disabled={props.busy !== null}
            />
          )}

          {props.mandateReview && (
            <MandateReviewPanel
              draft={props.mandateReview}
              onCancel={() => props.setMandateReview(null)}
              onConfirm={props.onSignMandate}
              disabled={props.busy !== null}
            />
          )}

          <TransactionStatus tx={props.tx} config={config} />

          <Identities config={config} account={account} />
          <Balances config={config} account={account} />

          {mandate && (
            <div className="metrics">
              <div>
                <span>Per payment</span>
                <strong>{formatUsdc(BigInt(mandate.perPaymentCapUnits))} USDC</strong>
              </div>
              <div>
                <span>Cumulative</span>
                <strong>{formatUsdc(BigInt(mandate.cumulativeCapUnits))} USDC</strong>
              </div>
              <div>
                <span>Expires</span>
                <strong>{new Date(Number(mandate.expiresAt) * 1000).toLocaleDateString()}</strong>
              </div>
            </div>
          )}

          <div className="owner-actions">
            <button
              className="secondary"
              onClick={props.onRevoke}
              disabled={!mandate || mandate.revoked || props.busy !== null}
            >
              Revoke mandate
            </button>
            <button
              className="secondary"
              onClick={props.onWithdraw}
              disabled={
                !account?.accountAddress ||
                BigInt(account.balances.accountUsdcUnits) === 0n ||
                props.busy !== null
              }
            >
              Withdraw
            </button>
          </div>
          <p className="hint">
            {props.accountError
              ? `Account state unavailable: ${props.accountError}`
              : 'Owner actions always require the owner wallet. The backend never holds its key.'}
          </p>
        </article>

        <article className="panel agent-panel">
          <div className="panel-heading">
            <div>
              <p className="kicker">AGENT RUNNER</p>
              <h2>Make a payment</h2>
            </div>
            <span className="agent-dot">Restricted signer</span>
          </div>
          <form onSubmit={props.onPreview}>
            <label htmlFor="instruction">Instruction</label>
            <textarea
              id="instruction"
              value={props.instruction}
              onChange={(event) => props.setInstruction(event.target.value)}
              maxLength={2000}
            />
            <div className="examples">
              <button
                type="button"
                onClick={() => props.setInstruction(`Pay 40 USDC to ${config.recipientLabel}`)}
              >
                40 USDC
              </button>
              <button
                type="button"
                onClick={() => props.setInstruction(`Pay 70 USDC to ${config.recipientLabel}`)}
              >
                70 USDC
              </button>
            </div>
            <button
              className="primary"
              type="submit"
              disabled={!canRun(props) || props.preview !== null}
            >
              Run agent <span>→</span>
            </button>
          </form>

          {props.preview && (
            <div className="resolved" data-testid="instruction-preview">
              <span>RESOLVED BEFORE SUBMISSION</span>
              <strong>{props.preview.amountUsdc} USDC</strong>
              <strong>{props.preview.recipientLabel}</strong>
              <code>{props.preview.recipient}</code>
              <code>Mandate #{props.preview.mandateId}</code>
              <code>Request {shorten(props.preview.requestId)}</code>
              <div className="resolved-actions">
                <button className="secondary" onClick={props.onCancelPreview}>
                  Cancel
                </button>
                <button className="primary" onClick={props.onSubmitInstruction}>
                  Submit request <span>→</span>
                </button>
              </div>
            </div>
          )}

          <PaymentStatus payment={props.payment} config={config} />
        </article>
      </section>

      <section className="grid evidence-grid">
        <article className="panel timeline-panel">
          <div className="panel-heading timeline-heading">
            <div>
              <p className="kicker">THE GRAPH</p>
              <h2>Indexed activity</h2>
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
            <span className="freshness-badge">
              {freshnessLabel(props.page, props.lastGoodPage)}
            </span>
            <span>
              {source?.indexedBlock
                ? `Indexed through block ${source.indexedBlock}`
                : 'No indexed block'}
              {source?.indexedAt
                ? ` · ${new Date(Number(source.indexedAt) * 1000).toUTCString()}`
                : ''}
              {source?.sourceDeployment ? ` · ${source.sourceDeployment}` : ''}
            </span>
          </div>

          {props.pending.length > 0 && (
            <div className="indexing-note">
              <span>
                {props.pending.length} confirmed on-chain result
                {props.pending.length === 1 ? '' : 's'} awaiting indexing.
              </span>
              {props.indexingWindowClosed && (
                <button
                  className="text-button"
                  onClick={props.onCheckIndexing}
                  disabled={props.checkingIndexing}
                >
                  {props.checkingIndexing ? 'Checking…' : 'Check indexing again'}
                </button>
              )}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="empty">
              <strong>No activity loaded</strong>
              <span>Run an instruction after setup.</span>
            </div>
          ) : (
            <ol className="timeline">
              {visible.map((entry) =>
                entry.kind === 'indexed' ? (
                  <li key={entry.key}>
                    <span className={`event-icon ${entry.record.outcome.toLowerCase()}`}>
                      {entry.record.outcome === 'EXECUTED' ? '✓' : '!'}
                    </span>
                    <div className="event-main">
                      <div>
                        <strong>{formatUsdc(BigInt(entry.record.attempted))} USDC</strong>
                        <span className={`status ${entry.record.outcome.toLowerCase()}`}>
                          {entry.record.outcome}
                        </span>
                      </div>
                      <p>
                        {entry.record.outcome === 'REFUSED'
                          ? `Successful on-chain refusal · ${entry.record.rule}`
                          : `Paid ${shorten(entry.record.recipient)}`}
                      </p>
                      <small>
                        Request {shorten(entry.record.requestId)} · Mandate #
                        {entry.record.mandateId} ·{' '}
                        <a
                          href={explorerTxUrl(config, entry.record.transactionHash)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          transaction ↗
                        </a>
                      </small>
                    </div>
                    <div className="headroom">
                      <span>HEADROOM</span>
                      <strong>{formatUsdc(BigInt(entry.record.headroom))}</strong>
                      <small>USDC</small>
                    </div>
                  </li>
                ) : (
                  <li key={entry.key} className="pending-row">
                    <span className="event-icon indexing">◷</span>
                    <div className="event-main">
                      <div>
                        <strong>{formatUsdc(BigInt(entry.pending.attempted))} USDC</strong>
                        <span className="status indexing">INDEXING</span>
                        <span className={`status ${entry.pending.outcome.toLowerCase()}`}>
                          {entry.pending.outcome}
                        </span>
                      </div>
                      <p>
                        On-chain; indexing pending.{' '}
                        {entry.pending.outcome === 'REFUSED'
                          ? `Successful on-chain refusal · ${entry.pending.rule}`
                          : 'Payment released by the account contract.'}
                      </p>
                      <small>
                        Request {shorten(entry.pending.requestId)} · Mandate #
                        {entry.pending.mandateId} ·{' '}
                        <a
                          href={explorerTxUrl(config, entry.pending.txHash)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          transaction ↗
                        </a>
                      </small>
                    </div>
                    <div className="headroom">
                      <span>HEADROOM</span>
                      <strong>{formatUsdc(BigInt(entry.pending.headroom))}</strong>
                      <small>USDC</small>
                    </div>
                  </li>
                ),
              )}
            </ol>
          )}
        </article>

        <AnswerPanel
          question={props.question}
          setQuestion={props.setQuestion}
          onAsk={props.onAsk}
          answer={props.answer}
          asking={props.asking}
          disabled={!account?.accountAddress}
        />
      </section>

      <footer>
        <span>GOL · ARC TESTNET ONLY</span>
        <span>USDC payments · Contract-enforced policy · Indexed evidence</span>
      </footer>
    </main>
  );
}

function canRun(props: DashboardProps): boolean {
  if (!props.account?.accountAddress || props.account.activeMandateId === '0') return false;
  const stage = props.payment.stage;
  return PAYMENT_STAGES[stage].terminal;
}

function SetupChecklist(props: {
  steps: SetupStep[];
  busy: OwnerActionKind | null;
  next: SetupStep | null;
  config: PublicConfig;
  onAction: (action: OwnerActionKind) => void;
}) {
  const complete = props.steps.filter((step) => step.status === 'complete').length;
  return (
    <div className="setup">
      <div className="setup-progress">
        <span>
          SETUP {complete} OF {props.steps.length}
        </span>
        <div className="setup-bar">
          <i style={{ width: `${(complete / props.steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="setup-steps">
        {props.steps.map((step, index) => (
          <li key={step.id} className={step.status} data-step={step.id}>
            <span className="setup-index">{step.status === 'complete' ? '✓' : index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              {step.status === 'blocked' && step.id === 'owner_gas' && props.config.faucetUrl && (
                <a href={props.config.faucetUrl} target="_blank" rel="noreferrer">
                  Open the configured Arc faucet ↗
                </a>
              )}
              {step.status === 'current' && step.action && step.actionLabel && (
                <button
                  className="primary setup-button"
                  onClick={() => props.onAction(step.action!)}
                  disabled={props.busy !== null}
                >
                  {props.busy === step.action ? 'Waiting for confirmation…' : step.actionLabel}
                  <span>→</span>
                </button>
              )}
            </div>
            <span className="setup-status">{statusWord(step.status)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function statusWord(status: SetupStep['status']): string {
  if (status === 'complete') return 'DONE';
  if (status === 'current') return 'NEXT';
  if (status === 'blocked') return 'BLOCKED';
  return 'WAITING';
}

function ConsentPanel(props: {
  config: PublicConfig;
  account: AccountSnapshot | null;
  recipientInput: string;
  setRecipientInput: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const account = props.account?.accountAddress ?? null;
  return (
    <div className="review" data-testid="agent-consent">
      <p className="kicker">REVIEW BEFORE PROVISIONING</p>
      <dl>
        <dt>Purpose</dt>
        <dd>Submit GOL payment requests to your account contract and nothing else.</dd>
        <dt>Chain</dt>
        <dd>
          {props.config.chainName} · eip155:{props.config.chainId}
        </dd>
        <dt>Only destination</dt>
        <dd>
          <code>{account ?? 'account not created yet'}</code>
        </dd>
        <dt>Native value</dt>
        <dd>Exactly zero. The signer can never move native balance.</dd>
        <dt>Everything else</dt>
        <dd>Denied by default. Calldata is not restricted by this policy.</dd>
        <dt>Revocation</dt>
        <dd>Revoke the mandate from your owner wallet at any time.</dd>
      </dl>
      <label htmlFor="recipient">Approved recipient address</label>
      <input
        id="recipient"
        className="setup-input"
        placeholder="0x contractor address"
        value={props.recipientInput}
        onChange={(event) => props.setRecipientInput(event.target.value)}
      />
      <div className="review-actions">
        <button className="secondary" onClick={props.onCancel}>
          Cancel
        </button>
        <button className="primary" onClick={props.onConfirm} disabled={props.disabled}>
          I understand, provision the agent wallet <span>→</span>
        </button>
      </div>
    </div>
  );
}

/** Shows the exact destination and amount before an owner is asked to sign a transfer. */
function TransferReviewPanel(props: {
  review: TransferReview;
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <div className="review" data-testid="transfer-review">
      <p className="kicker">REVIEW BEFORE SIGNATURE</p>
      <dl>
        <dt>Action</dt>
        <dd>{props.review.title}</dd>
        <dt>Exact amount</dt>
        <dd>{formatUsdc(BigInt(props.review.amountUnits))} USDC</dd>
        <dt>{props.review.destinationLabel}</dt>
        <dd>
          <code>{props.review.destination}</code>
        </dd>
        <dt>Note</dt>
        <dd>{props.review.note}</dd>
      </dl>
      <div className="review-actions">
        <button className="secondary" onClick={props.onCancel}>
          Cancel
        </button>
        <button className="primary" onClick={props.onConfirm} disabled={props.disabled}>
          Sign transfer <span>→</span>
        </button>
      </div>
    </div>
  );
}

function MandateReviewPanel(props: {
  draft: MandateDraft;
  onCancel: () => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <div className="review" data-testid="mandate-review">
      <p className="kicker">REVIEW BEFORE SIGNATURE</p>
      <dl>
        <dt>Agent wallet</dt>
        <dd>
          <code>{props.draft.agent}</code>
        </dd>
        <dt>Per-payment cap</dt>
        <dd>{formatUsdc(BigInt(props.draft.perPaymentCapUnits))} USDC</dd>
        <dt>Cumulative cap</dt>
        <dd>{formatUsdc(BigInt(props.draft.cumulativeCapUnits))} USDC</dd>
        <dt>Approved recipient</dt>
        <dd>
          {props.draft.recipientLabel} <code>{props.draft.recipient}</code>
        </dd>
        <dt>Expiry</dt>
        <dd>{new Date(Number(props.draft.expiresAt) * 1000).toUTCString()}</dd>
      </dl>
      <div className="review-actions">
        <button className="secondary" onClick={props.onCancel}>
          Cancel
        </button>
        <button className="primary" onClick={props.onConfirm} disabled={props.disabled}>
          Sign mandate <span>→</span>
        </button>
      </div>
    </div>
  );
}

function TransactionStatus({ tx, config }: { tx: TransactionState; config: PublicConfig }) {
  if (tx.phase === 'idle' || tx.kind === null) return null;
  return (
    <div className={`tx-status ${tx.phase}`} role="status" data-testid="owner-transaction">
      <strong>{TRANSACTION_PHASES[tx.phase]}</strong>
      {tx.detail && <span>{tx.detail}</span>}
      {tx.hash && (
        <a href={explorerTxUrl(config, tx.hash)} target="_blank" rel="noreferrer">
          {shorten(tx.hash)} ↗
        </a>
      )}
    </div>
  );
}

function PaymentStatus({ payment, config }: { payment: PaymentView; config: PublicConfig }) {
  const stage = PAYMENT_STAGES[payment.stage];
  return (
    <div className="run-state" role="status" data-testid="payment-stage">
      <i />
      <div>
        <strong>{stage.label}</strong>
        <span>{stage.detail}</span>
        {payment.rule && payment.stage === 'refused' && <span>Rule {payment.rule}</span>}
        {payment.headroomUnits && payment.stage === 'refused' && (
          <span>{formatUsdc(BigInt(payment.headroomUnits))} USDC of headroom remained.</span>
        )}
        {payment.detail && <span>{payment.detail}</span>}
        {payment.warning && <span className="warn">{payment.warning}</span>}
        {payment.txHash && (
          <a
            href={payment.explorerUrl ?? explorerTxUrl(config, payment.txHash)}
            target="_blank"
            rel="noreferrer"
          >
            {shorten(payment.txHash)} ↗
          </a>
        )}
      </div>
    </div>
  );
}

function Identities({
  config,
  account,
}: {
  config: PublicConfig;
  account: AccountSnapshot | null;
}) {
  const rows: Array<[string, string | null]> = [
    ['Owner wallet', account?.ownerAddress ?? null],
    ['GOL account', account?.accountAddress ?? null],
    ['Agent wallet', account?.agentAddress ?? null],
    ['Approved recipient', account?.recipients[0]?.address ?? null],
  ];
  return (
    <div className="identities">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          {value ? (
            <AddressChip config={config} value={value} />
          ) : (
            <code className="muted">not configured yet</code>
          )}
        </div>
      ))}
    </div>
  );
}

function AddressChip({ config, value }: { config: PublicConfig; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="address-chip">
      <code title={value}>{shorten(value)}</code>
      <button
        type="button"
        aria-label={`Copy address ${value}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1_500);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <a href={explorerAddressUrl(config, value)} target="_blank" rel="noreferrer">
        Explorer ↗
      </a>
    </span>
  );
}

function Balances({ config, account }: { config: PublicConfig; account: AccountSnapshot | null }) {
  const balances = account?.balances;
  return (
    <div className="balances">
      <div>
        <span>GOL payment balance</span>
        <strong>{balances ? formatUsdc(BigInt(balances.accountUsdcUnits)) : '—'} USDC</strong>
        <small>ERC-20 view. Spendable by the mandate.</small>
      </div>
      <div>
        <span>Owner gas</span>
        <strong>{balances ? `${formatNativeGas(BigInt(balances.ownerGasWei))} USDC` : '—'}</strong>
        <small>Native Arc gas view. Never added to the payment balance.</small>
      </div>
      <div>
        <span>Agent gas reserve</span>
        <strong>{balances ? `${formatNativeGas(BigInt(balances.agentGasWei))} USDC` : '—'}</strong>
        <small>
          Top-ups of {formatUsdc(BigInt(config.agentGasTopUpUnits))} USDC sit outside the mandate
          budget.
        </small>
      </div>
    </div>
  );
}

function freshnessLabel(page: ActivityPage | null, lastGood: ActivityPage | null): string {
  if (!page && !lastGood) return 'NOT LOADED';
  if (page?.integrityMismatch) return 'INTEGRITY MISMATCH';
  if (!page || page.freshness === 'unavailable') {
    return lastGood ? 'UNAVAILABLE — SHOWING LAST INDEXED RESULT' : 'UNAVAILABLE';
  }
  if (page.freshness === 'stale') return 'STALE';
  if (page.freshness === 'catching_up') return 'CATCHING UP';
  if (page.freshness === 'unknown') return 'FRESHNESS UNKNOWN';
  return 'CURRENT';
}

function AnswerPanel(props: {
  question: string;
  setQuestion: (value: string) => void;
  onAsk: (event: FormEvent) => void;
  answer: GroundedAnswer | null;
  asking: boolean;
  disabled: boolean;
}) {
  return (
    <article className="panel question-panel">
      <div className="panel-heading">
        <div>
          <p className="kicker">READ-ONLY QUESTIONS</p>
          <h2>Ask the record</h2>
        </div>
        <span className="lock">◇ No signing access</span>
      </div>
      <form onSubmit={props.onAsk}>
        <label htmlFor="question">Question about indexed activity</label>
        <div className="question-input">
          <input
            id="question"
            value={props.question}
            onChange={(event) => props.setQuestion(event.target.value)}
            maxLength={1000}
          />
          <button type="submit" aria-label="Ask question" disabled={props.disabled || props.asking}>
            →
          </button>
        </div>
      </form>
      {props.answer ? (
        <div className="answer" role="status" data-testid="grounded-answer">
          <span className="answer-label">
            {answerLabel(props.answer)} · {props.answer.recordCount} RECORD
            {props.answer.recordCount === 1 ? '' : 'S'}
          </span>
          <p>{props.answer.text}</p>
          <div className="answer-meta">
            <span>
              {props.answer.indexedBlock
                ? `Indexed through block ${props.answer.indexedBlock}`
                : 'No indexed block'}
            </span>
            <span>{props.answer.sourceDeployment ?? 'no deployment reported'}</span>
            <span>Freshness {props.answer.freshness}</span>
            {props.answer.partial && <span>Partial evidence set</span>}
            <span>
              {props.answer.deterministic ? 'Deterministic explanation' : 'Model explanation'}
            </span>
          </div>
          {props.answer.citations.length > 0 && (
            <ul className="citations">
              {props.answer.citations.map((citation) => (
                <li key={`${citation.txHash}:${citation.logIndex}`}>
                  <a href={citation.explorerUrl} target="_blank" rel="noreferrer">
                    {shorten(citation.txHash)} · log {citation.logIndex} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="question-empty">
          <span>?</span>
          <p>
            Answers use indexed events only.
            <br />
            They cannot initiate a payment.
          </p>
        </div>
      )}
    </article>
  );
}

function answerLabel(answer: GroundedAnswer): string {
  if (answer.status === 'model_error') return 'EXPLANATION UNAVAILABLE';
  if (answer.status === 'unavailable') return 'EVIDENCE UNAVAILABLE';
  if (answer.status === 'empty') return 'NO MATCHING RECORDS';
  if (answer.status === 'stale') return 'GROUNDED ANSWER (STALE)';
  if (answer.status === 'partial') return 'GROUNDED ANSWER (PARTIAL)';
  return 'GROUNDED ANSWER';
}

function shorten(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}
