'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

const arcTestnet = {
  id: 5_042_002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
} as const;

export function Providers({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return children;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        appearance: { theme: 'light', accentColor: '#ea5b36' },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
