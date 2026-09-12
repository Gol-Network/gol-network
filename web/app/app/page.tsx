import type { Metadata } from 'next';
import { Providers } from '../providers';
import { ConfigurationNotice } from '@/components/ConfigurationNotice';
import { GolApp } from '@/components/GolApp';
import { publicConfigResult } from '@/server/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Arc testnet prototype',
  description: 'Explore the current owner-controlled agent payment prototype on Arc testnet.',
  alternates: { canonical: '/app' },
  openGraph: {
    type: 'website',
    siteName: 'Gol',
    url: '/app',
    title: 'Gol Arc testnet prototype',
    description: 'Explore the current owner-controlled agent payment prototype on Arc testnet.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gol Arc testnet prototype',
    description: 'Explore the current owner-controlled agent payment prototype on Arc testnet.',
  },
};

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[] | undefined }>;
}) {
  const result = publicConfigResult();
  if (!result.ok) return <ConfigurationNotice fields={result.fields} />;
  const preview = (await searchParams).preview;
  const forceLoading = process.env.NODE_ENV === 'development' && preview === 'loading';
  return (
    <Providers config={result.config}>
      <GolApp config={result.config} forceLoading={forceLoading} />
    </Providers>
  );
}
