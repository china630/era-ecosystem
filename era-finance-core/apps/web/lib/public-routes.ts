/**
 * Public auth / document routes — shared by middleware and client guards.
 * Marketing (landing, pricing, register) lives on Orchestrator.
 */
export function isPublicWebPath(pathname: string): boolean {
  if (pathname === "/") return true; // middleware: guest -> local /login, authed -> /home
  if (pathname === "/login") return true;
  if (pathname === "/auth/cp-handoff") return true;
  if (pathname.startsWith("/verify/")) return true;
  if (pathname.startsWith("/portal")) return true;
  if (pathname.startsWith("/api/")) return true;
  return false;
}

/** Routes rendered without ERP `AppShell` chrome. */
export function isBarePublicWebPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/login") return true;
  if (pathname.startsWith("/portal")) return true;
  if (pathname.startsWith("/verify/")) return true;
  return false;
}
