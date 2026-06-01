import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@era/i18n-common", "@era/satellite-kit"],
  async redirects() {
    return [
      { source: "/industry/fb-pos", destination: "/industry/fnb-pos", permanent: true },
      { source: "/industry/auto", destination: "/industry/auto-service", permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
