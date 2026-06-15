import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@era/i18n-common", "@era/satellite-kit"],
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
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
