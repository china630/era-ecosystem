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
  async redirects() {
    return [
      { source: '/availability', destination: '/fo/availability', permanent: false },
      { source: '/room-plan', destination: '/fo/room-plan', permanent: false },
      { source: '/in-house', destination: '/fo/in-house', permanent: false },
      { source: '/reports/reservations', destination: '/fo/reservations', permanent: false },
      { source: '/reports/reservations/:path*', destination: '/fo/reservations/:path*', permanent: false },
      { source: '/reports/group-reservations', destination: '/fo/groups', permanent: false },
      { source: '/reports/room-changes', destination: '/fo/room-changes', permanent: false },
      { source: '/reports/reservation-times', destination: '/fo/reservation-times', permanent: false },
      { source: '/housekeeping', destination: '/hk', permanent: false },
      { source: '/housekeeping/:path*', destination: '/hk/:path*', permanent: false },
      { source: '/operations', destination: '/night-audit', permanent: false },
      { source: '/reports/end-of-day-logs', destination: '/night-audit/logs', permanent: false },
      { source: '/reports/inhouse-daily', destination: '/night-audit/inhouse-daily', permanent: false },
      { source: '/reports/agency-ledger', destination: '/front-cash/agency-ledger', permanent: false },
      { source: '/channel', destination: '/distribution/channel', permanent: false },
      { source: '/admin/contracts', destination: '/distribution/contracts', permanent: false },
      { source: '/admin/allotment-blocks', destination: '/distribution/allotment-blocks', permanent: false },
      { source: '/admin/promotion-codes', destination: '/distribution/promotion-codes', permanent: false },
      { source: '/admin/travel-agencies', destination: '/distribution/travel-agencies', permanent: false },
      { source: '/admin/child-matrix', destination: '/distribution/child-matrix', permanent: false },
      { source: '/admin/yield-rules', destination: '/distribution/yield-rules', permanent: false },
      { source: '/admin/master-data', destination: '/settings/master-data', permanent: false },
      { source: '/admin/bar-calendar', destination: '/settings/bar-calendar', permanent: false },
      { source: '/admin/users', destination: '/settings/users', permanent: false },
      { source: '/admin/integration', destination: '/settings/integration', permanent: false },
      { source: '/admin/audit', destination: '/settings/audit', permanent: false },
      { source: '/admin/stock', destination: '/settings/stock', permanent: false },
      { source: '/admin/import', destination: '/settings/import', permanent: false },
    ];
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
