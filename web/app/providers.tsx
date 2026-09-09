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
