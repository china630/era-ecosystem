import type { MetadataRoute } from "next";
import { SITE_HOST } from "../lib/site/site-origins";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/login",
          "/workspace",
          "/super-admin",
          "/register-org",
          "/api/",
        ],
      },
    ],
    sitemap: `https://${SITE_HOST}/sitemap.xml`,
    host: `https://${SITE_HOST}`,
  };
}
