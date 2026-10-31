import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Keep standalone under apps/platform-web/.next/standalone/apps/platform-web
  // even when a parent monorepo lockfile exists (local Windows).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@era/i18n-common", "@era/satellite-kit"],
};

export default withNextIntl(nextConfig);
