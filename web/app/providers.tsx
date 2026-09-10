'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';
import type { PublicConfig } from '@/config';

export function Providers({ config, children }: { config: PublicConfig; children: ReactNode }) {
  if (!config.privyAppId) return children;
  const arcTestnet = {
    id: config.chainId,
    name: config.chainName,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
    blockExplorers: { default: { name: 'Arc Explorer', url: config.explorerUrl } },
    testnet: true,
  } as const;
  return (
    <PrivyProvider
      appId={config.privyAppId}
      config={{
        loginMethods: ['email', 'google', 'passkey', 'wallet'],
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        appearance: {
          theme: '#0b0b0c',
          accentColor: '#3478f6',
          logo: '/gol-mark-blue.svg',
          landingHeader: 'Sign in to GOL Network',
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
