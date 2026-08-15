/**
 * Edge-only middleware surface — single file, no imports from ./session or main barrel.
 * Next.js middleware must not bundle Node `crypto` (password/sso/orchestrator-gateway).
 */
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

export const DEFAULT_PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/sso/exchange",
  "/api/health",
  "/api/events/dispatch",
  "/api/locale",
];

export const DEFAULT_PUBLIC_PAGE_PREFIXES = ["/login", "/sso/callback", "/help"];

export const DEFAULT_BARE_PUBLIC_PAGE_PREFIXES = [
  "/login",
  "/sso/callback",
  "/help",
  "/register",
  "/register-org",
  "/pricing",
  "/terms",
  "/partner",
];

export const ERA_PATHNAME_HEADER = "x-era-pathname";

export function isPublicApiPath(
  pathname: string,
  extraPrefixes: string[] = [],
): boolean {
  const prefixes = [...DEFAULT_PUBLIC_API_PREFIXES, ...extraPrefixes];
  return prefixes.some((p) => pathname.startsWith(p));
}

export function isBarePublicWebPath(
  pathname: string,
  extraPrefixes: string[] = [],
): boolean {
  const prefixes = [...DEFAULT_BARE_PUBLIC_PAGE_PREFIXES, ...extraPrefixes];
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export type HeaderReader = {
  get(name: string): string | null;
};

export function getBearerOrCookieToken(
  cookies: CookieReader,
  headers: HeaderReader,
  cookieName: string,
): string | undefined {
  const cookie = cookies.get(cookieName)?.value;
  if (cookie) return cookie;
  const auth = headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return undefined;
}

export function eraPathnameRequestHeaders(
  source: Headers,
  pathname: string,
): Headers {
  const next = new Headers(source);
  next.set(ERA_PATHNAME_HEADER, pathname);
  return next;
}

export function authCookieName(): string {
  return process.env.AUTH_COOKIE_NAME ?? "era_session";
}

function jwtSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_JWT_SECRET must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export type EdgeSessionPayload = {
  sub: string;
  login: string;
  role: string;
  fullName: string;
  /** Present when issued at login/SSO — used for platform super-admin gates. */
  email?: string;
  organizationId?: string;
};

/** JWT verify for Next.js Edge middleware (jose only — no Node crypto). */
export async function verifySatelliteSession(
  token: string,
): Promise<EdgeSessionPayload> {
  const { payload } = await jwtVerify(token, jwtSecret());
  const sub = payload.sub;
  if (!sub || typeof sub !== "string") throw new Error("Invalid token subject");
  return {
    sub,
    login: String(payload.login ?? ""),
    role: String(payload.role ?? ""),
    fullName: String(payload.fullName ?? ""),
    email: payload.email != null ? String(payload.email) : undefined,
    organizationId:
      payload.organizationId != null
        ? String(payload.organizationId)
        : undefined,
  };
}

export function redirectNoStore(url: URL | string): NextResponse {
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  return res;
}
