import {
  ACCESS_TOKEN_KEY,
  CP_ACCESS_TOKEN_KEY,
  CP_REFRESH_TOKEN_KEY,
  ORGS_KEY,
  USER_KEY,
  clearControlPlaneTokens,
  setControlPlaneTokens,
} from "./session-keys";
import { isPublicWebPath } from "./public-routes";

/**
 * В браузере — относительный origin (`/api/...`), чтобы запросы шли через Next rewrites на бэкенд.
 * На сервере (RSC и т.п.) — прямой URL API.
 */
export function apiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4100";
}

/** Control plane (era-orchestrator) — billing, subscription, referrals, early-access. */
export function controlPlaneBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return (
    process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ??
    process.env.CONTROL_PLANE_URL ??
    "http://127.0.0.1:4000"
  ).replace(/\/$/, "");
}

const CP_API_PREFIXES = [
  "/api/subscription",
  "/api/billing",
  "/api/partner",
  "/api/early-access",
  "/api/public/pricing",
  "/api/admin/config/billing",
  "/api/admin/pricing-bundles",
  "/api/admin/pricing-modules",
  "/api/admin/referrals",
  "/api/admin/early-access",
  "/api/platform/notifications",
  "/api/admin/platform/notifications",
] as const;

function isControlPlaneApiPath(pathname: string): boolean {
  if (
    CP_API_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }
  return /^\/api\/admin\/organizations\/[^/]+\/subscription$/.test(pathname);
}

/** Maps Finance `/api/...` routes to orchestrator (`/cp/...` in browser). */
export function resolveApiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const qIndex = path.indexOf("?");
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const search = qIndex >= 0 ? path.slice(qIndex) : "";
  if (!isControlPlaneApiPath(pathname)) {
    return `${apiBaseUrl()}${path}`;
  }
  let cpPath: string;
  if (pathname.startsWith("/api/platform/")) {
    cpPath = pathname.replace(/^\/api\//, "/");
  } else {
    cpPath = pathname.replace(/^\/api\//, "/v1/");
  }
  if (typeof window !== "undefined") {
    return `/cp${cpPath}${search}`;
  }
  return `${controlPlaneBaseUrl()}${cpPath}${search}`;
}

function parsePathname(path: string): string {
  try {
    if (path.startsWith("http")) {
      return new URL(path).pathname;
    }
    return (path.split("?")[0] ?? path).trim();
  } catch {
    return path;
  }
}

let cpRefreshInFlight: Promise<string | null> | null = null;

/** Refresh Orchestrator access token using the handoff refresh JWT. */
async function refreshControlPlaneAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (cpRefreshInFlight) return cpRefreshInFlight;

  cpRefreshInFlight = (async () => {
    const refreshToken = sessionStorage.getItem(CP_REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;
    try {
      const res = await fetch("/cp/auth/token/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        credentials: "include",
      });
      if (!res.ok) {
        clearControlPlaneTokens();
        return null;
      }
      const data = (await res.json()) as {
        accessToken?: string;
        refreshToken?: string;
      };
      if (!data.accessToken) {
        clearControlPlaneTokens();
        return null;
      }
      setControlPlaneTokens(
        data.accessToken,
        data.refreshToken ?? refreshToken,
      );
      return data.accessToken;
    } catch {
      clearControlPlaneTokens();
      return null;
    } finally {
      cpRefreshInFlight = null;
    }
  })();

  return cpRefreshInFlight;
}

function applyBearerForRequest(path: string, headers: Headers): boolean {
  const pathname = parsePathname(path);
  if (isControlPlaneApiPath(pathname)) {
    // Never send Finance-local JWT to Orchestrator (different identity store).
    const cpToken = sessionStorage.getItem(CP_ACCESS_TOKEN_KEY);
    if (cpToken) {
      headers.set("Authorization", `Bearer ${cpToken}`);
      return true;
    }
    headers.delete("Authorization");
    return false;
  }
  // Respect caller-supplied Bearer (e.g. CP JWT on /auth/cp-provision).
  if (headers.has("Authorization")) {
    return true;
  }
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    return true;
  }
  return false;
}

function clearFinanceSessionAndRedirectToLogin(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(ORGS_KEY);
  clearControlPlaneTokens();
  const currentPath = window.location.pathname;
  if (!isPublicWebPath(currentPath)) {
    window.location.replace("/login");
  }
}

function parseApiErrorMessage(text: string): string {
  const trimmed = text.trim().slice(0, 800);
  if (!trimmed) return "";
  try {
    const j = JSON.parse(trimmed) as unknown;
    if (!j || typeof j !== "object") return trimmed;
    const o = j as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (Array.isArray(o.message) && o.message.every((x) => typeof x === "string")) {
      return o.message.join("; ");
    }
    if (typeof o.error === "string") return o.error;
    if (o.message && typeof o.message === "object" && o.message !== null) {
      const m = o.message as Record<string, unknown>;
      if (typeof m.message === "string") return m.message;
    }
  } catch {
    /* not JSON */
  }
  return trimmed;
}

async function emitApiErrorToast(res: Response): Promise<void> {
  try {
    const text = await res.clone().text();
    const message = parseApiErrorMessage(text) || `HTTP ${res.status}`;
    window.dispatchEvent(
      new CustomEvent("erafinance:api-error", {
        detail: { status: res.status, message },
      }),
    );
  } catch {
    window.dispatchEvent(
      new CustomEvent("erafinance:api-error", {
        detail: { status: res.status, message: `HTTP ${res.status}` },
      }),
    );
  }
}

/** Same event as {@link emitApiErrorToast} for failures without a `Response` (e.g. network). */
export function emitClientApiError(status: number, message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("erafinance:api-error", {
      detail: { status, message },
    }),
  );
}

export function apiFetch(
  path: string,
  init: RequestInit = {},
  opts?: { allowCpRefresh?: boolean },
): Promise<Response> {
  const allowCpRefresh = opts?.allowCpRefresh !== false;
  const headers = new Headers(init.headers);
  const pathname = parsePathname(path);
  const isCp = isControlPlaneApiPath(pathname);
  let sentAuth = false;
  if (typeof window !== "undefined") {
    sentAuth = applyBearerForRequest(path, headers);
  }
  const url = resolveApiUrl(path);

  const run = (requestInit: RequestInit): Promise<Response> =>
    fetch(url, {
      ...requestInit,
      credentials: "include",
    });

  return run({ ...init, headers }).then(async (res) => {
    const method = (init.method ?? "GET").toUpperCase();
    const normalizedPath = pathname.replace(/\/+$/, "") || pathname;
    const isAuthLoginPost =
      method === "POST" &&
      (normalizedPath === "/api/auth/login" ||
        normalizedPath.endsWith("/api/auth/login"));
    const isCpProvisionPost =
      method === "POST" &&
      (normalizedPath === "/api/auth/cp-provision" ||
        normalizedPath.endsWith("/api/auth/cp-provision"));

    if (res.status === 401 && typeof window !== "undefined") {
      if (isAuthLoginPost || isCpProvisionPost) {
        // Wrong password / invalid credentials — do not redirect (user is already on /login).
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(ORGS_KEY);
        clearControlPlaneTokens();
      } else if (isCp) {
        // Soft-fail: CP billing/subscription must not wipe the Finance ERP session.
        if (sentAuth && allowCpRefresh) {
          const refreshed = await refreshControlPlaneAccessToken();
          if (refreshed) {
            headers.set("Authorization", `Bearer ${refreshed}`);
            return apiFetch(path, { ...init, headers }, { allowCpRefresh: false });
          }
          clearControlPlaneTokens();
        } else if (sentAuth) {
          clearControlPlaneTokens();
        }
      } else if (sentAuth || headers.has("Authorization")) {
        clearFinanceSessionAndRedirectToLogin();
      }
    }
    let skipApiErrorToast = false;
    if (res.status === 403 && typeof window !== "undefined") {
      const clone = res.clone();
      try {
        const data: unknown = await clone.json();
        if (
          data &&
          typeof data === "object" &&
          "code" in data &&
          (data as { code?: string }).code === "SUBSCRIPTION_READ_ONLY"
        ) {
          skipApiErrorToast = true;
          window.dispatchEvent(
            new CustomEvent("erafinance:subscription-read-only", {
              detail: data,
            }),
          );
        }
        if (
          data &&
          typeof data === "object" &&
          "code" in data &&
          (data as { code?: string }).code === "MODULE_NOT_ENTITLED"
        ) {
          skipApiErrorToast = true;
        }
      } catch {
        /* ignore */
      }
    }
    if (res.status === 402 && typeof window !== "undefined") {
      const clone = res.clone();
      try {
        const data: unknown = await clone.json();
        const code =
          data && typeof data === "object" && "code" in data
            ? (data as { code?: string }).code
            : undefined;
        if (
          code === "QUOTA_EXCEEDED" ||
          code === "CREDIT_HARD_LOCK" ||
          code === "USAGE_CAP_EXCEEDED"
        ) {
          skipApiErrorToast = true;
          window.dispatchEvent(
            new CustomEvent("erafinance:quota-upgrade", { detail: data }),
          );
        }
      } catch {
        /* ignore */
      }
    }
    const isRead = method === "GET" || method === "HEAD";
    if (
      typeof window !== "undefined" &&
      res.status >= 400 &&
      !skipApiErrorToast &&
      !isRead &&
      (res.status !== 401 || isAuthLoginPost)
    ) {
      void emitApiErrorToast(res);
    }
    return res;
  });
}

/**
 * POST with `keepalive` for `pagehide` / unmount (includes Authorization header).
 * Fire-and-forget; errors are swallowed by the browser on unload.
 */
export function apiPostKeepalive(path: string, body: unknown): void {
  if (typeof window === "undefined") return;
  const headers = new Headers({ "Content-Type": "application/json" });
  applyBearerForRequest(path, headers);
  const url = resolveApiUrl(path);
  void fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    keepalive: true,
    credentials: "include",
  });
}
