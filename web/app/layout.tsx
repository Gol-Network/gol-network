import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import { publicConfigResult } from '@/server/env';
import { ConfigurationNotice } from '@/components/ConfigurationNotice';
import './globals.css';

// Public configuration is read when the container starts, not when the image is built, so the
// same production image can be pointed at different Privy, Arc, and explorer endpoints.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'GOL | Controlled agent payments',
  description: 'Owner-controlled USDC agent payments on Arc testnet',
  other: {
    // Base Build domain-ownership verification for https://gol.network/
    'base:app_id': '6aa1a55014c95246af9c958f',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const result = publicConfigResult();
  return (
    <html lang="en">
      <body>
        {result.ok ? (
          <Providers config={result.config}>{children}</Providers>
        ) : (
          <ConfigurationNotice fields={result.fields} />
        )}
      </body>
    </html>
  );
}
