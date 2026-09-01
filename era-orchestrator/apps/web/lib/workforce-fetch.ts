import { getOrchAccessToken } from "./orch-api";

/** Extract the tenant org id from the orchestrator JWT (for x-organization-id header). */
export function orgIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const claims = JSON.parse(atob(token.split(".")[1] ?? "")) as {
      organizationId?: string | null;
    };
    return claims.organizationId ?? null;
  } catch {
    return null;
  }
}

function withAuthHeaders(init: RequestInit): RequestInit {
  const token = getOrchAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const orgId = orgIdFromToken(token);
  if (orgId && !headers.has("x-organization-id")) {
    headers.set("x-organization-id", orgId);
  }
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return { ...init, headers };
}

export type WorkforceApiError = {
  status: number;
  code?: string;
  message: string;
};

/** Parse Nest JSON (`{ code, message }` or wrapped `message: { code }`) from a failed workforce call. */
export async function parseWorkforceApiError(
  res: Response,
): Promise<WorkforceApiError> {
  const raw = await res.text();
  let code: string | undefined;
  let message = raw || res.statusText;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (typeof j.code === "string") code = j.code;
    const nested = j.message;
    if (typeof nested === "string") message = nested;
    else if (nested && typeof nested === "object") {
      const n = nested as { code?: string; message?: string };
      if (typeof n.code === "string") code = n.code;
      if (typeof n.message === "string") message = n.message;
    }
  } catch {
    /* keep raw body */
  }
  if (!code && raw.includes("LOGIN_TAKEN")) code = "LOGIN_TAKEN";
  if (!code && raw.includes("LOGIN_REQUIRES_BINDING")) {
    code = "LOGIN_REQUIRES_BINDING";
  }
  return { status: res.status, code, message };
}

/** Fetch the CP Workforce hub API through the web proxy. */
export function workforceFetch(path: string, init: RequestInit = {}) {
  return fetch(
    `/api/platform/workforce/${path.replace(/^\//, "")}`,
    withAuthHeaders(init),
  );
}

/** Fetch the MDM workforce (person identity) API through the web proxy. */
export function mdmWorkforceFetch(path: string, init: RequestInit = {}) {
  return fetch(
    `/api/platform/mdm/workforce/${path.replace(/^\//, "")}`,
    withAuthHeaders(init),
  );
}

/**
 * Detect the `PLATFORM_WORKFORCE_REQUIRED` entitlement gate (HTTP 403).
 * Returns true when the response means "Workforce module is not enabled".
 */
export async function isWorkforceGate403(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { code?: string } | null;
  return body?.code === "PLATFORM_WORKFORCE_REQUIRED";
}

/** Enable the platform_workforce module for the current org. Returns true on success. */
export async function enableWorkforceModule(): Promise<boolean> {
  const { orchFetch } = await import("./orch-api");
  const token = getOrchAccessToken();
  if (!token) return false;
  const res = await orchFetch("/v1/billing/toggle-module", {
    token,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moduleKey: "platform_workforce", enabled: true }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** CSV text or xlsx base64 for workforce import endpoints. */
export async function fileToWorkforceImportBody(
  file: File,
): Promise<{ csv?: string; xlsxBase64?: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { xlsxBase64: btoa(binary) };
  }
  return { csv: await file.text() };
}
