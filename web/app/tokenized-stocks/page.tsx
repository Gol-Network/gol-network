import type { Metadata } from 'next';
import { TokenizedStocksApp } from '@/components/tokenized-stocks/TokenizedStocksApp';
import './legacy.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'GOL | Tokenized stocks on Base (mock)',
  description:
    'Base hackathon mock: tokenized equities, a portfolio, an agent trading desk, and a mandate.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <TokenizedStocksApp />;
}
