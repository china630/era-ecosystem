import type { NextConfig } from "next";
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
  transpilePackages: ["@era/i18n-common", "@era/satellite-kit"],
  async rewrites() {
    return [
      { source: "/api/locale", destination: `${orchApi}/v1/locale` },
      { source: "/api/public/pricing", destination: `${orchApi}/v1/public/pricing` },
      { source: "/api/cp-admin", destination: `${orchApi}/v1/admin` },
      { source: "/api/cp-admin/:path*", destination: `${orchApi}/v1/admin/:path*` },
      { source: "/api/portal/mdm", destination: `${orchApi}/portal/v1/mdm/access` },
      { source: "/api/portal/mdm/:path*", destination: `${orchApi}/portal/v1/mdm/access/:path*` },
      { source: "/api/platform/workforce", destination: `${orchApi}/platform/v1/workforce` },
      {
        source: "/api/platform/workforce/:path*",
        destination: `${orchApi}/platform/v1/workforce/:path*`,
      },
    ];
  },
  async redirects() {
    const platform =
      process.env.NEXT_PUBLIC_ERA_PLATFORM_ORIGIN?.replace(/\/$/, "") ||
      "https://platform.era-365.online";
    return [
      { source: "/industry/fb-pos", destination: "/industry/fnb-pos", permanent: true },
      { source: "/industry/auto", destination: "/industry/auto-service", permanent: true },
      // SuperAdmin cutover → platform console (short paths)
      {
        source: "/super-admin",
        destination: `${platform}/`,
        permanent: false,
      },
      {
        source: "/super-admin/:path*",
        destination: `${platform}/:path*`,
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
