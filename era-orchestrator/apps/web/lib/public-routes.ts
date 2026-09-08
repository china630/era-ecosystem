const BARE_PUBLIC_PREFIXES = [
  "/login",
  "/sso/callback",
  "/help",
  "/register",
  "/register-org",
  "/pricing",
  "/satellites",
  "/terms",
  "/partner",
] as const;

/** Guest marketing + auth pages render without the logged-in app shell. */
export function isBarePublicWebPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  return BARE_PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
