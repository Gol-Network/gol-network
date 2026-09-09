export const ARC_TESTNET_CHAIN_ID = 5_042_002;
export const ARC_TESTNET_CAIP2 = 'eip155:5042002';
export const ARC_TESTNET_RPC_URL = 'https://rpc.testnet.arc.network';
export const ARC_TESTNET_EXPLORER_URL = 'https://testnet.arcscan.app';
export const ARC_TESTNET_USDC = '0x3600000000000000000000000000000000000000' as const;
export const USDC_DECIMALS = 6;

/**
 * Arc settles gas in its native USDC view, which reports eighteen decimals even though the
 * ERC-20 view of the same balance reports six. The two views are never added together.
 */
export const ARC_NATIVE_DECIMALS = 18;
export const MAX_UINT256 = (1n << 256n) - 1n;

/** Cumulative and per-payment cap used by the exact 100/40/70 demonstration. */
export const DEMO_MANDATE_CAP_UNITS = 100_000_000n;
/** Owner-to-agent gas top-up default. Operators may override it with a small demo amount. */
export const DEFAULT_AGENT_GAS_TOPUP_UNITS = 1_000_000n;
/** Strict maximum page size for the visible indexed timeline. */
export const ACTIVITY_PAGE_MAX = 50;
/** Strict maximum number of indexed records supplied to a grounded answer. */
export const ANSWER_RECORD_MAX = 100;

/** Contract refusal rules in `GolAccount` enum order. */
export const REFUSAL_RULES = [
  'NONE',
  'MANDATE_REVOKED',
  'MANDATE_EXPIRED',
  'RECIPIENT_NOT_ALLOWED',
  'PER_PAYMENT_CAP',
  'CUMULATIVE_CAP',
] as const;

export type RefusalRule = (typeof REFUSAL_RULES)[number];
