import { stripLocalePrefix } from "./site/locale-path";

const BARE_PUBLIC_PREFIXES = [
  "/login",
  "/sso/callback",
  "/help",
  "/register",
  "/register-org",
  "/pricing",
  "/calc",
  "/calculator",
  "/satellites",
  "/industries",
  "/demo",
  "/contact",
  "/terms",
  "/partner",
  "/kafe",
] as const;

/** Guest marketing + auth pages render without the logged-in app shell. */
export function isBarePublicWebPath(pathname: string): boolean {
  const bare = stripLocalePrefix(pathname);
  if (bare === "/" || bare === "") return true;
  return BARE_PUBLIC_PREFIXES.some(
    (p) => bare === p || bare.startsWith(`${p}/`),
  );
}
