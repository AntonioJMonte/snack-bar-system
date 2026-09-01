import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O pacote de contratos é TypeScript compilado no monorepo; o Next precisa
  // transpilá-lo junto (workspace local, não dependência publicada).
  transpilePackages: ['@lanchonete/contracts'],
};

export default nextConfig;
