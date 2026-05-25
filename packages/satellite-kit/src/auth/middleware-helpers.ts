export const DEFAULT_PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/sso/exchange",
  "/api/health",
  "/api/events/dispatch",
];

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
