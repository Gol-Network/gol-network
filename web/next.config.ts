import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  distDir: process.env.NEXT_DIST_DIR?.trim() || '.next',
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url)),
  reactStrictMode: true,
  transpilePackages: ['@gol/protocol', '@gol/agent'],
  experimental: {
    optimizePackageImports: ['@privy-io/react-auth'],
  },
};

export default nextConfig;
