import type { NextRequest } from "next/server";
import { defaultLocale, ERA_I18N_COOKIE, isLocale, type Locale } from "@era/i18n-common";

/** Preferred locale for public site redirects (cookie → Accept-Language → az). */
export function resolveSiteLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(ERA_I18N_COOKIE)?.value;
  if (cookie && isLocale(cookie)) return cookie;

  const accept = (request.headers.get("accept-language") ?? "").toLowerCase();
  if (/\bru\b|ru-/.test(accept)) return "ru";
  if (/\ben\b|en-/.test(accept)) return "en";
  if (/\baz\b|az-/.test(accept)) return "az";
  return defaultLocale;
}