import { MAX_UINT256, USDC_DECIMALS } from './constants.js';

const USDC_AMOUNT = /^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/;

export class InvalidUsdcAmountError extends Error {
  readonly code = 'INVALID_USDC_AMOUNT';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidUsdcAmountError';
  }
}

export function parseUsdc(value: string): bigint {
  if (!USDC_AMOUNT.test(value)) {
    throw new InvalidUsdcAmountError('Use a positive USDC amount with at most six decimals');
  }

  const [whole = '', fraction = ''] = value.split('.');
  const units = BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(fraction.padEnd(6, '0'));
  if (units === 0n) {
    throw new InvalidUsdcAmountError('USDC amount must be greater than zero');
  }
  if (units > MAX_UINT256) {
    throw new InvalidUsdcAmountError('USDC amount exceeds uint256');
  }
  return units;
}

export function formatUsdc(units: bigint): string {
  if (units < 0n || units > MAX_UINT256) {
    throw new InvalidUsdcAmountError('USDC units must fit uint256');
  }
  const base = 10n ** BigInt(USDC_DECIMALS);
  const whole = units / base;
  const fraction = (units % base).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '');
  return fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
}
