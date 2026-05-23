import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@era/satellite-kit'],
  serverExternalPackages: ['@prisma/client', 'redis'],
};

export default withNextIntl(nextConfig);
