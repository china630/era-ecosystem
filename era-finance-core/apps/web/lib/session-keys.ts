export const ACCESS_TOKEN_KEY = "erafinance_access_token";
/** Mirror access token into cookie so Next middleware can gate SSR. */
export const ACCESS_TOKEN_COOKIE_KEY = "erafinance_access_token";
/**
 * Orchestrator-issued JWT for control-plane proxies (`/cp/v1/subscription`, billing, …).
 * Distinct from {@link ACCESS_TOKEN_KEY}: Finance `sub` ≠ Orch `sub`, so the local
 * Finance session token must never be sent to Orchestrator.
 */
export const CP_ACCESS_TOKEN_KEY = "erafinance_cp_access_token";
export const CP_REFRESH_TOKEN_KEY = "erafinance_cp_refresh_token";
export const USER_KEY = "erafinance_user";
export const ORGS_KEY = "erafinance_organizations";
/** Флаги из GET /auth/me (RBAC UI). */
export const ACCESS_FLAGS_KEY = "erafinance_access_flags";
/** External auditor: accepted invite + plaintext token (browser only). */
export const AUDIT_ENGAGEMENT_INVITE_ID_KEY = "erafinance_audit_engagement_invite_id";
export const AUDIT_ENGAGEMENT_TOKEN_KEY = "erafinance_audit_engagement_token";

export function setControlPlaneTokens(
  accessToken: string,
  refreshToken?: string | null,
): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(CP_ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    sessionStorage.setItem(CP_REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearControlPlaneTokens(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(CP_ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(CP_REFRESH_TOKEN_KEY);
}
