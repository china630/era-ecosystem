import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@era/i18n-common", "@era/satellite-kit"],
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
