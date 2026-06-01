import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@era/i18n-common', '@era/satellite-kit'],
  outputFileTracingIncludes: {
    '/*': [
      './messages/**/*',
      './node_modules/@era/i18n-common/messages/**/*',
      '../packages/i18n-common/messages/**/*',
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
  serverExternalPackages: ['@prisma/client', 'redis'],
};

export default withNextIntl(nextConfig);
