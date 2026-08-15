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
  // Reverse proxy to the orchestrator control plane; it enforces its own Bearer auth.
  // The finance edge middleware must not intercept it (e.g. pre-session SSO handoff redeem).
  if (pathname.startsWith("/cp/")) return true;
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
