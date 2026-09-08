import { describe, expect, it } from 'vitest';
import { formatUsdc, InvalidUsdcAmountError, MAX_UINT256, parseUsdc } from '../src/index.js';

describe('parseUsdc', () => {
  it.each([
    ['0.000001', 1n],
    ['1', 1_000_000n],
    ['40', 40_000_000n],
    ['100.123456', 100_123_456n],
  ])('parses %s exactly', (text, units) => expect(parseUsdc(text)).toBe(units));

  it.each(['0', '0.000000', '-1', '+1', '01', '1.', '.1', '1.0000001', '1e6', '1,000', ' 1'])(
    'rejects %s',
    (text) => expect(() => parseUsdc(text)).toThrow(InvalidUsdcAmountError),
  );

  it('accepts the uint256 limit and rejects one micro-USDC more', () => {
    const whole = MAX_UINT256 / 1_000_000n;
    const fraction = (MAX_UINT256 % 1_000_000n).toString().padStart(6, '0');
    expect(parseUsdc(`${whole}.${fraction}`)).toBe(MAX_UINT256);
    expect(() => parseUsdc(`${whole}.${(MAX_UINT256 % 1_000_000n) + 1n}`)).toThrow();
  });
});

describe('formatUsdc', () => {
  it('formats without floating point conversion', () => {
    expect(formatUsdc(40_000_000n)).toBe('40');
    expect(formatUsdc(100_123_400n)).toBe('100.1234');
    expect(formatUsdc(1n)).toBe('0.000001');
  });
});
