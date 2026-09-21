import { ORG_NO_RE, UUID_RE } from "./login-org-no-format";

/** Browser localStorage key for last successful staff login org code (A3/A5). */
export const LOGIN_ORG_NO_STORAGE_KEY = "era.login.orgNo";

export function readLoginOrgNoPrefill(searchParams: {
  get: (key: string) => string | null;
}): string {
  const fromQuery = searchParams.get("org")?.trim() ?? "";
  if (fromQuery) {
    if (UUID_RE.test(fromQuery)) return "";
    if (ORG_NO_RE.test(fromQuery)) return fromQuery;
    return "";
  }
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    try {
      return localStorage.getItem(LOGIN_ORG_NO_STORAGE_KEY)?.trim() ?? "";
    } catch {
      return "";
    }
  }
  return "";
}

export function persistLoginOrgNo(orgNo: string): void {
  const v = orgNo.trim();
  if (!v || typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
    return;
  }
  try {
    localStorage.setItem(LOGIN_ORG_NO_STORAGE_KEY, v);
  } catch {
    // ignore quota / privacy mode
  }
}
