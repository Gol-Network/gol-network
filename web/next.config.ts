import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url)),
  reactStrictMode: true,
  transpilePackages: ['@gol/protocol', '@gol/agent'],
  experimental: {
    optimizePackageImports: ['@privy-io/react-auth'],
  },
};

export default nextConfig;
