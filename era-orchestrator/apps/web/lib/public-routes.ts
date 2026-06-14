const BARE_PUBLIC_PREFIXES = [
  "/login",
  "/sso/callback",
  "/help",
  "/register",
  "/register-org",
  "/pricing",
  "/terms",
  "/partner",
] as const;

export function isBarePublicWebPath(pathname: string): boolean {
  return BARE_PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
