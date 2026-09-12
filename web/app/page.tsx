import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = {
  description:
    'A proposed account model where owners set enforceable limits for agents and keep a record of allowed and refused actions. Explore the Arc testnet prototype.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Gol',
    url: '/',
    title: 'Gol | On-chain limits for AI agents',
    description:
      'Owners set the mandate. Agents can ask. The policy boundary decides where money moves.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gol | On-chain limits for AI agents',
    description:
      'Owners set the mandate. Agents can ask. The policy boundary decides where money moves.',
  },
};

export default function Page() {
  return <LandingPage />;
}
