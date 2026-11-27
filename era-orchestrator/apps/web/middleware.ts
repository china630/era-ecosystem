import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  eraPathnameRequestHeaders,
  redirectReferralToOrchestratorRegister,
} from "@era/satellite-kit/auth/middleware-edge";
import {
  ERA_SITE_LOCALE_HEADER,
  hasLocalePrefix,
  isPublicMarketingPath,
  localeFromPathname,
  needsLocaleRedirect,
  siteLocalePath,
  stripLocalePrefix,
} from "./lib/site/locale-path";
import { resolveSiteLocale } from "./lib/site/resolve-site-locale";
import { APP_HOST, SITE_HOST } from "./lib/site/site-origins";

const CABINET_PREFIXES = [
  "/login",
  "/register",
  "/register-org",
  "/workspace",
  "/partner",
  "/holdings",
  "/super-admin",
  "/organizations",
  "/settings",
  "/agency",
  "/buyer",
  "/portal",
  "/access-denied",
  "/industry",
] as const;

function isCabinetPath(pathname: string): boolean {
  const bare = stripLocalePrefix(pathname);
  return CABINET_PREFIXES.some((p) => bare === p || bare.startsWith(`${p}/`));
}

function requestHost(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(":")[0]?.trim() ||
    ""
  );
}

export function middleware(request: NextRequest) {
  const referralRedirect = redirectReferralToOrchestratorRegister(request);
  if (referralRedirect) return referralRedirect;
  const path = request.nextUrl.pathname;
  const host = requestHost(request);

  // Host split: marketing on apex, cabinet on app (production hosts only).
  if (host === SITE_HOST || host === `www.${SITE_HOST}`) {
    if (isCabinetPath(path)) {
      const dest = new URL(request.url);
      dest.hostname = APP_HOST;
      dest.protocol = "https:";
      dest.port = "";
      return NextResponse.redirect(dest, 308);
    }
  } else if (host === APP_HOST) {
    if (path !== "/" && isPublicMarketingPath(path) && !isCabinetPath(path)) {
      const dest = new URL(request.url);
      dest.hostname = SITE_HOST;
      dest.protocol = "https:";
      dest.port = "";
      return NextResponse.redirect(dest, 308);
    }
  }

  const isApexHost = host === SITE_HOST || host === `www.${SITE_HOST}`;
  // Apex: `/` → `/{locale}`. Dual-purpose local/app keep `/` for auth gate (HomePageClient).
  if (
    !path.startsWith("/api") &&
    needsLocaleRedirect(path) &&
    !(path === "/" && !isApexHost)
  ) {
    const locale = resolveSiteLocale(request);
    const target = siteLocalePath(locale, path === "/" ? "/" : path);
    const dest = new URL(target, request.url);
    request.nextUrl.searchParams.forEach((value, key) => dest.searchParams.set(key, value));
    return NextResponse.redirect(dest, 308);
  }
  const mdmProxy =
    path === "/api/cp-mdm" ||
    path.startsWith("/api/cp-mdm/") ||
    path === "/api/platform/mdm/workforce" ||
    path.startsWith("/api/platform/mdm/workforce/");
  if (mdmProxy) {
    const callerAuth = request.headers.get("authorization")?.trim() ?? "";
    if (!callerAuth.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const serviceToken =
      process.env.MDM_INTERNAL_SERVICE_TOKEN ??
      process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN ??
      process.env.CONTROL_PLANE_SERVICE_TOKEN ??
      process.env.SATELLITE_EVENT_SERVICE_TOKEN ??
      "";
    if (!serviceToken && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "MDM service token not configured" }, { status: 503 });
    }
    const api = (
      process.env.ORCH_API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_ORCH_API_URL ||
      "http://127.0.0.1:4000"
    ).replace(/\/$/, "");
    const destPath = path.startsWith("/api/platform/mdm/workforce")
      ? path.replace("/api/platform/mdm/workforce", "/internal/v1/mdm/persons")
      : path.replace("/api/cp-mdm", "/internal/v1/mdm");
    const dest = new URL(`${api}${destPath}`);
    request.nextUrl.searchParams.forEach((value, key) => dest.searchParams.set(key, value));
    const orgId = request.headers.get("x-organization-id")?.trim();
    if (orgId && !dest.searchParams.has("organizationId")) {
      dest.searchParams.set("organizationId", orgId);
    }
    const headers = eraPathnameRequestHeaders(request.headers, path);
    headers.set("authorization", callerAuth);
    if (serviceToken) headers.set("x-service-token", serviceToken);
    if (orgId) headers.set("x-organization-id", orgId);
    return NextResponse.rewrite(dest, { request: { headers } });
  }
  const reqHeaders = eraPathnameRequestHeaders(
    request.headers,
    request.nextUrl.pathname,
  );
  const pathLocale = localeFromPathname(path);
  if (pathLocale) {
    reqHeaders.set(ERA_SITE_LOCALE_HEADER, pathLocale);
  } else if (hasLocalePrefix(path)) {
    reqHeaders.set(ERA_SITE_LOCALE_HEADER, resolveSiteLocale(request));
  }
  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
