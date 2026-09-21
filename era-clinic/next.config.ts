import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Host hot-reload: browser uses 127.0.0.1; Next prints localhost — without this,
  // /_next/* is treated as cross-origin and SSO soft-nav can stick on "Signing you in…".
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@era/i18n-common", "@era/satellite-kit", "@era/clinic-domain"],
  experimental: {
    serverActions: { bodySizeLimit: "32mb" },
    middlewareClientMaxBodySize: "32mb",
  },
  outputFileTracingIncludes: {
    "/*": [
      "./messages/**/*",
      "./node_modules/@era/i18n-common/messages/**/*",
      "../packages/i18n-common/messages/**/*",
    ],
  },
  serverExternalPackages: ["@prisma/client"],
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
};

export default withNextIntl(nextConfig);
