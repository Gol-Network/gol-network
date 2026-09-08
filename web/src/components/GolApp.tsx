'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { addressSchema, type ActivityRecord, type Address } from '@gol/protocol';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createAccount,
  createMandate,
  fundAccount,
  readAccount,
  revokeMandate,
  withdraw,
} from '@/wallet/owner-actions';

type AccountView = {
  state: 'ready';
  ownerAddress: Address;
  accountAddress: Address;
  agentAddress: Address;
  balanceUnits: string;
  activeMandateId: string;
  mandate: null | {
    perPaymentCapUnits: string;
    cumulativeCapUnits: string;
    spentUnits: string;
    expiresAt: string;
    revoked: boolean;
  };
};

const previewRecords: ActivityRecord[] = [
  previewRecord('02', 'REFUSED', '70000000', '0', 'CUMULATIVE_CAP', '2020'),
  previewRecord('01', 'EXECUTED', '40000000', '40000000', 'NONE', '1010'),
];

export function GolApp({ privyEnabled }: { privyEnabled: boolean }) {
  return privyEnabled ? <LiveGolApp /> : <PreviewGolApp />;
}

function LiveGolApp() {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [account, setAccount] = useState<AccountView | null>(null);
  const [accountState, setAccountState] = useState('Sign in to configure an account');
  const [recipient, setRecipient] = useState('');
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [freshness, setFreshness] = useState('unknown');
  const [instruction, setInstruction] = useState('Pay 40 USDC to Design contractor');
  const [runState, setRunState] = useState('Idle');
  const [question, setQuestion] = useState('Why was the 70 USDC payment refused?');
  const [answer, setAnswer] = useState('');

  const authedFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getAccessToken();
      if (!token) throw new Error('AUTH_REQUIRED');
      const response = await fetch(path, {
        ...init,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          ...init.headers,
        },
      });
      const value = (await response.json()) as Record<string, unknown>;
      if (!response.ok) throw new Error(String(value.error ?? `HTTP_${response.status}`));
      return value;
    },
    [getAccessToken],
  );

  const refreshAccount = useCallback(async () => {
    if (!authenticated) return;
    try {
      const value = await authedFetch('/api/account');
      if (value.state === 'no_account') {
        setAccount(null);
        setAccountState('No GOL account linked');
      } else {
        setAccount(value as unknown as AccountView);
        setAccountState('On-chain state verified');
      }
    } catch (error) {
      setAccountState(errorMessage(error));
    }
  }, [authenticated, authedFetch]);

  const refreshActivity = useCallback(
    async (selected = account) => {
      if (!selected) return;
      try {
        const value = await authedFetch(
          `/api/activity?account=${selected.accountAddress}&first=50`,
        );
        setRecords((value.records as ActivityRecord[]) ?? []);
        setFreshness(String(value.freshness ?? 'unknown'));
      } catch (error) {
        setFreshness(`unavailable: ${errorMessage(error)}`);
      }
    },
    [account, authedFetch],
  );

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);
  useEffect(() => {
    void refreshActivity();
  }, [refreshActivity]);
  useEffect(() => {
    if (!authenticated || !account) return;
    const requestId = window.localStorage.getItem(pendingRequestKey(account.accountAddress));
    if (!requestId) return;
    setRunState('Recovering pending request from durable journal');
    void pollRequest(requestId, account);
  }, [authenticated, account, authedFetch]);

  async function pollRequest(requestId: string, selected: AccountView) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await pause(2_000);
      const result = await authedFetch(`/api/requests/${requestId}`);
      const state = String(result.state);
      setRunState(paymentLabel(state, result));
      if (
        [
          'needs_clarification',
          'executed',
          'refused',
          'signer_blocked',
          'technical_failure',
          'unknown',
        ].includes(state)
      ) {
        window.localStorage.removeItem(pendingRequestKey(selected.accountAddress));
        await Promise.all([refreshAccount(), refreshActivity(selected)]);
        return;
      }
    }
    setRunState('Still pending. This request will recover after refresh.');
  }

  async function ownerProvider() {
    const preferred =
      wallets.find(
        (wallet) => wallet.address.toLowerCase() === user?.wallet?.address?.toLowerCase(),
      ) ?? wallets[0];
    if (!preferred) throw new Error('OWNER_WALLET_REQUIRED');
    return preferred.getEthereumProvider();
  }

  async function configure() {
    try {
      const approved = addressSchema.parse(recipient);
      const provider = await ownerProvider();
      let selected = account;
      if (!selected) {
        const factory = addressSchema.parse(process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? '');
        setAccountState('Waiting for owner account signature');
        const created = await createAccount(provider, factory);
        setAccountState('Creating restricted agent wallet');
        const setup = await authedFetch('/api/agent/setup', {
          method: 'POST',
          body: JSON.stringify({
            account: created.account,
            ownerAddress: created.owner,
            recipient: approved,
            recipientLabel: 'Design contractor',
            consent: true,
          }),
        });
        selected = {
          state: 'ready',
          ownerAddress: created.owner,
          accountAddress: created.account,
          agentAddress: setup.agentAddress as Address,
          balanceUnits: '0',
          activeMandateId: '0',
          mandate: null,
        };
      }
      const chain = await readAccount(selected.accountAddress);
      const target = 100_000_000n;
      if (chain.balance < target) {
        setAccountState(
          `Confirm funding ${formatUsdc(target - chain.balance)} USDC to ${selected.accountAddress}`,
        );
        await fundAccount(provider, selected.accountAddress, target - chain.balance);
      }
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
      if (
        !window.confirm(
          `Create mandate?\nAccount: ${selected.accountAddress}\nAgent: ${selected.agentAddress}\nPer payment: 100 USDC\nCumulative: 100 USDC\nExpires: ${new Date(Number(expiresAt) * 1000).toISOString()}\nRecipient: ${approved}`,
        )
      )
        throw new Error('OWNER_CANCELLED');
      setAccountState('Waiting for owner mandate signature');
      await createMandate(provider, selected.accountAddress, {
        agent: selected.agentAddress,
        perPaymentCap: target,
        cumulativeCap: target,
        expiresAt,
        recipients: [approved],
      });
      setAccountState('Mandate confirmed on Arc testnet');
      await refreshAccount();
    } catch (error) {
      setAccountState(errorMessage(error));
    }
  }

  async function runAgent(event: FormEvent) {
    event.preventDefault();
    if (!account || account.activeMandateId === '0')
      return setRunState('Create an active mandate first');
    try {
      const requestId = randomRequestId();
      window.localStorage.setItem(pendingRequestKey(account.accountAddress), requestId);
      setRunState('Queued in durable payment journal');
      await authedFetch('/api/instructions', {
        method: 'POST',
        body: JSON.stringify({
          account: account.accountAddress,
          mandateId: account.activeMandateId,
          requestId,
          text: instruction,
        }),
      });
      await pollRequest(requestId, account);
    } catch (error) {
      setRunState(errorMessage(error));
    }
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!account) return setAnswer('No linked account is available.');
    try {
      const result = await authedFetch('/api/questions', {
        method: 'POST',
        body: JSON.stringify({ account: account.accountAddress, question }),
      });
      setAnswer(String(result.text ?? 'No answer is available.'));
    } catch (error) {
      setAnswer(`Indexed evidence unavailable: ${errorMessage(error)}`);
    }
  }

  async function revoke() {
    if (
      !account ||
      account.activeMandateId === '0' ||
      !window.confirm(`Revoke mandate #${account.activeMandateId} on ${account.accountAddress}?`)
    )
      return;
    try {
      setAccountState('Waiting for owner revoke signature');
      await revokeMandate(
        await ownerProvider(),
        account.accountAddress,
        BigInt(account.activeMandateId),
      );
      await refreshAccount();
    } catch (error) {
      setAccountState(errorMessage(error));
    }
  }

  async function withdrawAll() {
    if (
      !account ||
      BigInt(account.balanceUnits) === 0n ||
      !window.confirm(
        `Withdraw ${formatUsdc(account.balanceUnits)} USDC from ${account.accountAddress} to immutable owner ${account.ownerAddress}?`,
      )
    )
      return;
    try {
      setAccountState('Waiting for owner withdrawal signature');
      await withdraw(await ownerProvider(), account.accountAddress, BigInt(account.balanceUnits));
      await refreshAccount();
    } catch (error) {
      setAccountState(errorMessage(error));
    }
  }

  return (
    <Dashboard
      auth={{
        ready,
        authenticated,
        login,
        logout,
        label: user?.wallet?.address?.slice(0, 10) ?? 'Signed in',
      }}
      account={account}
      accountState={accountState}
      recipient={recipient}
      setRecipient={setRecipient}
      configure={() => void configure()}
      instruction={instruction}
      setInstruction={setInstruction}
      runAgent={runAgent}
      runState={runState}
      records={records}
      freshness={freshness}
      question={question}
      setQuestion={setQuestion}
      ask={ask}
      answer={answer}
      revoke={() => void revoke()}
      withdraw={() => void withdrawAll()}
    />
  );
}

function PreviewGolApp() {
  const [loaded, setLoaded] = useState(false);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [instruction, setInstruction] = useState('Pay 40 USDC to Design contractor');
  const [runState, setRunState] = useState('Local preview only. No transaction will be submitted.');
  const [question, setQuestion] = useState('Why was the 70 USDC payment refused?');
  const [answer, setAnswer] = useState('');
  function run(event: FormEvent) {
    event.preventDefault();
    const refusal = /\b70(?:\.0+)?\b/.test(instruction);
    const next = refusal ? previewRecords[0]! : previewRecords[1]!;
    setRecords((current) => [next, ...current.filter((row) => row.requestId !== next.requestId)]);
    setRunState(
      refusal
        ? 'Preview: policy refused on-chain fixture'
        : 'Preview: payment executed on-chain fixture',
    );
  }
  function ask(event: FormEvent) {
    event.preventDefault();
    setAnswer(
      records.some((row) => row.outcome === 'REFUSED')
        ? '70 USDC was refused because only 60 USDC remained after the 40 USDC payment.'
        : 'Load the acceptance fixture to inspect a refusal.',
    );
  }
  return (
    <Dashboard
      auth={{
        ready: true,
        authenticated: false,
        login: () => undefined,
        logout: () => undefined,
        label: 'Local preview',
      }}
      account={loaded ? previewAccount : null}
      accountState={
        loaded
          ? 'Local fixture loaded. No chain read was performed'
          : 'Set NEXT_PUBLIC_PRIVY_APP_ID to enable authenticated owner actions'
      }
      recipient=""
      setRecipient={() => undefined}
      configure={() => {
        setLoaded(true);
        setRecords(previewRecords);
      }}
      instruction={instruction}
      setInstruction={setInstruction}
      runAgent={run}
      runState={runState}
      records={records}
      freshness="fixture, not live"
      question={question}
      setQuestion={setQuestion}
      ask={ask}
      answer={answer}
      revoke={() => setRunState('Preview: owner revoke requires a wallet')}
      withdraw={() => setRunState('Preview: owner withdrawal requires a wallet')}
    />
  );
}

const previewAccount: AccountView = {
  state: 'ready',
  ownerAddress: `0x${'c'.repeat(40)}`,
  accountAddress: `0x${'d'.repeat(40)}`,
  agentAddress: `0x${'a'.repeat(40)}`,
  balanceUnits: '60000000',
  activeMandateId: '1',
  mandate: {
    perPaymentCapUnits: '100000000',
    cumulativeCapUnits: '100000000',
    spentUnits: '40000000',
    expiresAt: String(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60),
    revoked: false,
  },
};

type DashboardProps = {
  auth: {
    ready: boolean;
    authenticated: boolean;
    login: () => unknown;
    logout: () => unknown;
    label: string;
  };
  account: AccountView | null;
  accountState: string;
  recipient: string;
  setRecipient: (value: string) => void;
  configure: () => void;
  instruction: string;
  setInstruction: (value: string) => void;
  runAgent: (event: FormEvent) => void;
  runState: string;
  records: ActivityRecord[];
  freshness: string;
  question: string;
  setQuestion: (value: string) => void;
  ask: (event: FormEvent) => void;
  answer: string;
  revoke: () => void;
  withdraw: () => void;
};

function Dashboard(props: DashboardProps) {
  const [filter, setFilter] = useState<'ALL' | 'EXECUTED' | 'REFUSED'>('ALL');
  const mandate = props.account?.mandate;
  const spent = mandate?.spentUnits ?? '40000000';
  const cap = mandate?.cumulativeCapUnits ?? '100000000';
  const remaining = BigInt(cap) - BigInt(spent);
  const visible = useMemo(
    () => props.records.filter((row) => filter === 'ALL' || row.outcome === filter),
    [filter, props.records],
  );
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">G</span>
          <span>GOL</span>
        </a>
        <div className="top-actions">
          <span className="network">
            <i /> Arc testnet
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
              {props.auth.label === 'Local preview' ? props.auth.label : 'Sign in with Privy'}
            </button>
          )}
        </div>
      </header>
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
              {props.account?.activeMandateId === '0'
                ? 'Not active'
                : `#${props.account?.activeMandateId ?? '1'} active`}
            </strong>
          </div>
          <div>
            <span>Spent</span>
            <strong>{formatUsdc(spent)} USDC</strong>
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
              <h2>{mandate ? 'Active mandate' : 'Set up account'}</h2>
            </div>
            <span className={`status ${mandate && !mandate.revoked ? 'active' : 'refused'}`}>
              {mandate && !mandate.revoked ? 'Active' : 'Setup required'}
            </span>
          </div>
          <div className="budget-ring">
            <div>
              <small>AVAILABLE</small>
              <strong>{formatUsdc(remaining)}</strong>
              <span>USDC</span>
            </div>
          </div>
          <div className="metrics">
            <div>
              <span>Per payment</span>
              <strong>{formatUsdc(mandate?.perPaymentCapUnits ?? cap)} USDC</strong>
            </div>
            <div>
              <span>Cumulative</span>
              <strong>{formatUsdc(cap)} USDC</strong>
            </div>
            <div>
              <span>Expires</span>
              <strong>
                {mandate
                  ? new Date(Number(mandate.expiresAt) * 1000).toLocaleDateString()
                  : '7 days after setup'}
              </strong>
            </div>
          </div>
          {!mandate && (
            <>
              <label htmlFor="recipient">Approved recipient</label>
              <input
                id="recipient"
                className="setup-input"
                placeholder="0x contractor address"
                value={props.recipient}
                onChange={(event) => props.setRecipient(event.target.value)}
              />
              <button className="primary setup-button" onClick={props.configure}>
                {props.auth.authenticated
                  ? 'Create account and 100 USDC mandate'
                  : 'Load acceptance fixture'}{' '}
                <span>→</span>
              </button>
            </>
          )}
          {props.account && (
            <div className="identity-row">
              <div>
                <span>GOL account</span>
                <strong>{short(props.account.accountAddress)}</strong>
                <code>Agent {short(props.account.agentAddress)}</code>
              </div>
              <span className="verified">CHAIN VERIFIED</span>
            </div>
          )}
          <div className="owner-actions">
            <button className="secondary" onClick={props.revoke} disabled={!mandate}>
              Review revoke
            </button>
            <button className="secondary" onClick={props.withdraw} disabled={!props.account}>
              Withdraw
            </button>
          </div>
          <p className="hint">
            {props.accountState}. Owner actions always require the owner wallet.
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
          <form onSubmit={props.runAgent}>
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
                onClick={() => props.setInstruction('Pay 40 USDC to Design contractor')}
              >
                40 USDC
              </button>
              <button
                type="button"
                onClick={() => props.setInstruction('Pay 70 USDC to Design contractor')}
              >
                70 USDC
              </button>
            </div>
            <button className="primary" type="submit">
              Run agent <span>→</span>
            </button>
          </form>
          <div className="run-state" role="status">
            <i /> {props.runState}
          </div>
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
          <div className="freshness">
            <i /> {props.freshness}
            <span>Indexed source</span>
          </div>
          {visible.length === 0 ? (
            <div className="empty">
              <strong>No activity loaded</strong>
              <span>Run an instruction after setup.</span>
            </div>
          ) : (
            <ol className="timeline">
              {visible.map((row) => (
                <li key={row.actionId}>
                  <span className={`event-icon ${row.outcome.toLowerCase()}`}>
                    {row.outcome === 'EXECUTED' ? '✓' : '!'}
                  </span>
                  <div className="event-main">
                    <div>
                      <strong>{formatUsdc(row.attempted)} USDC</strong>
                      <span className={`status ${row.outcome.toLowerCase()}`}>{row.outcome}</span>
                    </div>
                    <p>{row.outcome === 'REFUSED' ? row.reason : `Paid ${short(row.recipient)}`}</p>
                    <small>
                      Request {short(row.requestId)} · Mandate #{row.mandateId} ·{' '}
                      <a
                        href={`https://testnet.arcscan.app/tx/${row.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        evidence ↗
                      </a>
                    </small>
                  </div>
                  <div className="headroom">
                    <span>HEADROOM</span>
                    <strong>{formatUsdc(row.headroom)}</strong>
                    <small>USDC</small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>
        <article className="panel question-panel">
          <div className="panel-heading">
            <div>
              <p className="kicker">READ-ONLY QUESTIONS</p>
              <h2>Ask the record</h2>
            </div>
            <span className="lock">◇ No signing access</span>
          </div>
          <form onSubmit={props.ask}>
            <label htmlFor="question">Question about indexed activity</label>
            <div className="question-input">
              <input
                id="question"
                value={props.question}
                onChange={(event) => props.setQuestion(event.target.value)}
                maxLength={1000}
              />
              <button type="submit" aria-label="Ask question">
                →
              </button>
            </div>
          </form>
          {props.answer ? (
            <div className="answer" role="status">
              <span className="answer-label">GROUNDED ANSWER</span>
              <p>{props.answer}</p>
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
      </section>
      <footer>
        <span>GOL · ARC TESTNET ONLY</span>
        <span>USDC payments · Contract-enforced policy · Indexed evidence</span>
      </footer>
    </main>
  );
}

function previewRecord(
  id: string,
  outcome: 'EXECUTED' | 'REFUSED',
  attempted: string,
  transferred: string,
  rule: string,
  tx: string,
): ActivityRecord {
  return {
    actionId: `0x${id}` as `0x${string}`,
    requestId: `0x${id.padStart(64, '0')}`,
    mandateId: '1',
    agent: `0x${'a'.repeat(40)}`,
    recipient: `0x${'b'.repeat(40)}`,
    outcome,
    rule,
    reason: outcome === 'REFUSED' ? 'Cumulative cap exceeded' : '',
    attempted,
    transferred,
    headroom: '60000000',
    spentAfter: '40000000',
    sequence: id === '01' ? '1' : '2',
    transactionHash: `0x${tx.padEnd(64, '0')}`,
    blockNumber: '61061383',
    blockHash: `0x${'c'.repeat(64)}`,
    timestamp: '1788864000',
    logIndex: '0',
  };
}

function formatUsdc(value: string | bigint) {
  const units = BigInt(value);
  const whole = units / 1_000_000n;
  const fraction = (units % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
function short(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected failure';
}
function pause(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function pendingRequestKey(account: string) {
  return `gol:pending:${account.toLowerCase()}`;
}
function randomRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
function paymentLabel(state: string, value: Record<string, unknown>) {
  if (state === 'refused') return `Policy refused on-chain: ${String(value.rule ?? 'policy rule')}`;
  if (state === 'executed') return `Payment executed on-chain: ${String(value.txHash ?? '')}`;
  if (state === 'signer_blocked') return 'Signer blocked before submission';
  if (state === 'technical_failure')
    return `Technical transaction failure: ${String(value.errorCode ?? '')}`;
  if (state === 'needs_clarification') return 'Needs clarification. No transaction submitted.';
  return `${state[0]?.toUpperCase() ?? ''}${state.slice(1)}`;
}
