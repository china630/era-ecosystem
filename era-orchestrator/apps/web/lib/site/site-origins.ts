import type { Locale } from "@era/i18n-common";
import { siteLocalePath } from "./locale-path";

export const SITE_HOST = "era-365.online";
export const APP_HOST = "app.era-365.online";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/** Public marketing site origin (apex). */
export function siteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === SITE_HOST || host === `www.${SITE_HOST}`) {
      return `${window.location.protocol}//${host}`;
    }
  }
  if (process.env.NODE_ENV === "production") return `https://${SITE_HOST}`;
  return "http://127.0.0.1:3000";
}

/** Authenticated control-plane origin (app subdomain). */
export function appOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  const legacy = process.env.NEXT_PUBLIC_ORCH_WEB_URL?.trim();
  if (legacy) return trimTrailingSlash(legacy);
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === APP_HOST) return `${window.location.protocol}//${host}`;
  }
  if (process.env.NODE_ENV === "production") return `https://${APP_HOST}`;
  return "http://127.0.0.1:3000";
}

/** Absolute URL on the marketing site with locale prefix. */
export function siteUrl(path: string, locale: Locale): string {
  const rel = siteLocalePath(locale, path);
  return `${siteOrigin()}${rel}`;
}

/** Absolute URL on the app / cabinet host (no locale prefix). */
export function appUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${appOrigin()}${p}`;
}