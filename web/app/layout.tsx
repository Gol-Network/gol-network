import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import { publicOrigin } from '@/content/site';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin),
  title: {
    default: 'Gol | On-chain limits for AI agents',
    template: '%s | Gol',
  },
  description:
    'A proposed account model where owners set enforceable limits for agents and keep a record of allowed and refused actions.',
  other: {
    // Base Build domain-ownership verification for the canonical production origin.
    'base:app_id': '6aa1a55014c95246af9c958f',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
