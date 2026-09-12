import type { ActivityPage, Address, GroundedAnswer } from '@gol/protocol';
import type { PreparedAaveTransaction } from './aave-transactions';

export interface RecipientEntry {
  address: Address;
  label: string;
}

export interface AccountBalances {
  /** ERC-20 USDC held directly by the owner wallet. */
  ownerUsdcUnits: string;
  /** ERC-20 USDC held by the GOL account and available to pay recipients. */
  accountUsdcUnits: string;
  /** Native Arc gas balances. Never added to the ERC-20 payment balance. */
  ownerGasWei: string;
  agentGasWei: string;
}

export interface MandateView {
  /** The agent address this mandate authorizes. May differ from the current signer after a cutover. */
  agent: Address;
  perPaymentCapUnits: string;
  cumulativeCapUnits: string;
  spentUnits: string;
  expiresAt: string;
  revoked: boolean;
}

export interface PolicyDisclosure {
  purpose: string;
  policyName: string;
  chain: string;
  chainId: number;
  destination: Address;
  allowedMethod: string;
  nativeValue: string;
  defaultAction: string;
  calldataRestricted: boolean;
  revocation: string;
}

export interface AccountSnapshot {
  ownerAddress: Address;
  /** Null until the factory has recorded an account for this owner. */
  accountAddress: Address | null;
  /** Null until the restricted agent wallet has been provisioned. */
  agentAddress: Address | null;
  /** True once the backend has linked this account to the authenticated session. */
  linked: boolean;
  policyId: string | null;
  policyDisclosure: PolicyDisclosure | null;
  recipients: RecipientEntry[];
  balances: AccountBalances;
  activeMandateId: string;
  mandate: MandateView | null;
}

export type OwnerActionKind =
  | 'create_account'
  | 'provision_agent'
  | 'fund_agent_gas'
  | 'fund_account'
  | 'sign_mandate'
  | 'revoke_mandate'
  | 'withdraw'
  | 'aave_action';

export type TransactionPhase =
  | 'idle'
  | 'awaiting_signature'
  | 'submitted'
  | 'confirmed'
  | 'rejected'
  | 'reverted'
  | 'insufficient_gas'
  | 'failed';

export interface TransactionState {
  kind: OwnerActionKind | null;
  phase: TransactionPhase;
  hash: string | null;
  detail: string;
}

export type TransactionReporter = (update: {
  phase: TransactionPhase;
  hash?: string | null;
  detail?: string;
}) => void;

/**
 * Durable stages an instruction moves through. `parsing` is the local resolution step before a
 * request is enqueued; every other stage is derived from the durable journal.
 */
export type PaymentStage =
  | 'idle'
  | 'parsing'
  | 'needs_clarification'
  | 'queued'
  | 'signing'
  | 'submitted'
  | 'confirming'
  | 'executed'
  | 'refused'
  | 'signer_blocked'
  | 'technical_failure'
  | 'unknown';

export interface RequestSnapshot {
  requestId: string;
  account: Address;
  state: string;
  recipient: Address | null;
  amountUnits: string | null;
  txHash: string | null;
  explorerUrl: string | null;
  rule: string | null;
  attemptedUnits: string | null;
  headroomUnits: string | null;
  errorCode: string | null;
  mandateId: string;
}

export interface MandateDraft {
  agent: Address;
  recipient: Address;
  recipientLabel: string;
  perPaymentCapUnits: string;
  cumulativeCapUnits: string;
  expiresAt: string;
}

export interface InstructionPreview {
  requestId: string;
  amountUsdc: string;
  recipient: Address;
  recipientLabel: string;
  mandateId: string;
}

export interface MoneyTokenRef {
  symbol: string;
  address: Address;
  chainId: number;
  decimals: number;
}

export interface MoneyTokenOption extends MoneyTokenRef {
  name: string;
  verified: boolean;
  priceUsd?: number | null;
  logoUri?: string | null;
}

export interface MoneySendInput {
  chainId: number;
  token: MoneyTokenRef;
  amount: string;
  recipient: Address;
}

export interface MoneySwapInput {
  fromChainId: number;
  toChainId: number;
  fromToken: MoneyTokenRef;
  toToken: MoneyTokenRef;
  amount: string;
  maxSlippageBps: number;
}

export interface MoneySwapQuote {
  supported: boolean;
  crossChain: boolean;
  amountOut: { symbol: string; amount: number };
  amountOutMin: { symbol: string; amount: number };
  rate: number;
  priceImpactBps?: number | null;
  route: Array<{
    tool: string;
    fromSymbol: string;
    toSymbol: string;
    fromChainId: number;
    toChainId: number;
  }>;
  fees: Array<{ symbol: string; amount: number }>;
  slippageBps: number;
  estimatedDurationSec?: number | null;
  unsupportedReason?: string | null;
}

export interface MoneyReceiveInfo {
  address: Address;
  uri?: string | null;
}

export interface MoneyExecutionResult {
  txHash: string | null;
  bridgeState?: 'delivered' | 'refunded' | 'failed' | 'pending';
  bridgeTxHash?: string | null;
  bridgeExplorerUrl?: string | null;
  bridgeMessage?: string | null;
}

/**
 * Everything the experience needs from a provider. The live backend talks to the GOL API and the
 * owner wallet; the fixture backend simulates the same call sequence so the mocked flow exercises
 * exactly the same interface states.
 */
export interface GolBackend {
  loadAccount(): Promise<AccountSnapshot | null>;
  ownerGasWei(): Promise<string>;
  createAccount(report: TransactionReporter): Promise<void>;
  provisionAgent(
    account: Address,
    owner: Address,
    recipient: Address,
    label: string,
  ): Promise<void>;
  fundAgentGas(agent: Address, units: bigint, report: TransactionReporter): Promise<void>;
  fundAccount(account: Address, units: bigint, report: TransactionReporter): Promise<void>;
  signMandate(account: Address, draft: MandateDraft, report: TransactionReporter): Promise<void>;
  revokeMandate(account: Address, mandateId: string, report: TransactionReporter): Promise<void>;
  withdraw(account: Address, units: bigint, report: TransactionReporter): Promise<void>;
  executeAaveTransaction(
    transaction: PreparedAaveTransaction,
    report: TransactionReporter,
  ): Promise<void>;
  listMoneyTokens(chainId: number): Promise<MoneyTokenOption[]>;
  quoteMoneySwap(input: MoneySwapInput): Promise<MoneySwapQuote>;
  executeMoneySwap(
    input: MoneySwapInput,
    report: TransactionReporter,
  ): Promise<MoneyExecutionResult>;
  executeMoneySend(
    input: MoneySendInput,
    report: TransactionReporter,
  ): Promise<MoneyExecutionResult>;
  getMoneyReceiveInfo(chainId: number, token: string): Promise<MoneyReceiveInfo>;
  submitInstruction(
    account: Address,
    requestId: string,
    text: string,
    mandateId: string,
  ): Promise<void>;
  getRequest(requestId: string): Promise<RequestSnapshot>;
  getActivity(account: Address): Promise<ActivityPage>;
  ask(account: Address, question: string): Promise<GroundedAnswer>;
}

export interface AuthState {
  /** Distinguishes real Privy authentication from the local product walkthrough. */
  mode: 'live' | 'fixture';
  ready: boolean;
  authenticated: boolean;
  label: string;
  error: string | null;
  /** The wallet GOL uses as the owner signer for this authenticated identity. */
  ownerAddress?: string | null;
  /** Non-fatal errors from authenticated wallet actions such as linking another wallet. */
  walletActionError?: string | null;
  login: (method?: 'email' | 'google' | 'twitter' | 'passkey' | 'wallet', prefill?: string) => void;
  /** Explicitly enters the local walkthrough without pretending to authenticate. */
  startFixture?: () => void;
  logout: () => void | Promise<void>;
  /** Browser wallets currently connected to the authenticated Privy session. */
  wallets?: Array<{
    address: string;
    chainId: number | null;
    name: string;
    imported: boolean;
    /** Only Privy-managed wallets can be exported through Privy's protected export flow. */
    exportable: boolean;
  }>;
  /** Opens Privy's authenticated wallet-link flow. Unavailable in fixture mode. */
  linkWallet?: () => void;
  /** Opens Privy's isolated export flow for the owner embedded wallet. */
  exportWallet?: (address: string) => Promise<void>;
}
