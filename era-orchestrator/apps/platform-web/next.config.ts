import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const orchApi = (
  process.env.ORCH_API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_ORCH_API_URL ||
  "http://127.0.0.1:4000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Keep standalone under apps/platform-web/.next/standalone/apps/platform-web
  // even when a parent monorepo lockfile exists (local Windows).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@era/i18n-common", "@era/satellite-kit"],
  async rewrites() {
    return [
      { source: "/api/locale", destination: `${orchApi}/v1/locale` },
      { source: "/api/cp-admin", destination: `${orchApi}/v1/admin` },
      { source: "/api/cp-admin/:path*", destination: `${orchApi}/v1/admin/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
