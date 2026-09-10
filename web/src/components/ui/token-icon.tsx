'use client';

import { Coins } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const WETH_BASE = '0x4200000000000000000000000000000000000006';

function isNativeEth(address: string, symbol: string): boolean {
  return (
    !address ||
    address.toLowerCase().startsWith('eth-native') ||
    address.toUpperCase() === 'ETH' ||
    symbol.toUpperCase() === 'ETH'
  );
}

function iconUrl(address: string, symbol: string): string {
  const tokenAddress = isNativeEth(address, symbol) ? WETH_BASE : address;
  return `https://assets.smold.app/api/token/8453/${tokenAddress}/logo-128.png`;
}

export function TokenIcon({
  address,
  symbol,
  alt,
  className,
}: {
  address: string;
  symbol: string;
  alt?: string | undefined;
  className?: string | undefined;
}) {
  const [failed, setFailed] = useState(false);
  const accessibleLabel = alt ?? `${symbol} token`;

  if (failed) {
    return (
      <span
        title={symbol}
        role="img"
        aria-label={accessibleLabel}
        className={cn(
          'flex items-center justify-center rounded-full bg-muted text-muted-foreground',
          className,
        )}
      >
        <Coins className="size-1/2" />
      </span>
    );
  }

  return (
    <img
      src={iconUrl(address, symbol)}
      alt={accessibleLabel}
      title={symbol}
      className={cn('rounded-full bg-muted object-cover', className)}
      onError={() => setFailed(true)}
    />
  );
}
