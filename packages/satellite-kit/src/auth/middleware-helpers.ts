export const DEFAULT_PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/sso/exchange",
  "/api/health",
  "/api/events/dispatch",
  "/api/locale",
  "/api/internal",
];

/** Page paths reachable without authentication (locale toggle, FAQ on login). */
export const DEFAULT_PUBLIC_PAGE_PREFIXES = ["/login", "/sso/callback", "/help"];

/** Full-bleed public pages — no app chrome (matches Finance `app/layout.tsx` bare shell). */
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

export function isBarePublicWebPath(
  pathname: string,
  extraPrefixes: string[] = [],
): boolean {
  const prefixes = [...DEFAULT_BARE_PUBLIC_PAGE_PREFIXES, ...extraPrefixes];
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function eraPathnameRequestHeaders(
  source: Headers,
  pathname: string,
): Headers {
  const next = new Headers(source);
  next.set(ERA_PATHNAME_HEADER, pathname);
  return next;
}

export function isPublicApiPath(
  pathname: string,
  extraPrefixes: string[] = [],
): boolean {
  const prefixes = [...DEFAULT_PUBLIC_API_PREFIXES, ...extraPrefixes];
  return prefixes.some((p) => pathname.startsWith(p));
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
