import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";
import { ORG_NO_RE, UUID_RE } from "./login-org-no-format";

export { ORG_NO_RE, UUID_RE } from "./login-org-no-format";

export type LoginOrgResolveResult =
  | { organizationId: string }
  | { miss: true }
  | { invalid: true };

const NEGATIVE_CACHE_TTL_MS = 15_000;

const orgNoToOrganizationId = new Map<string, string>();
const negativeMissUntil = new Map<string, number>();

function normalizeOrgNoKey(orgNo: number | string): string {
  return String(orgNo).trim();
}

/** A4 Sync stub — populate orgNo → UUID from control-plane Sync. */
export function upsertLoginOrgNo(orgNo: number | string, organizationId: string): void {
  const key = normalizeOrgNoKey(orgNo);
  orgNoToOrganizationId.set(key, organizationId.trim());
  negativeMissUntil.delete(key);
}

export function lookupLoginOrgNo(orgNo: number | string): string | undefined {
  return orgNoToOrganizationId.get(normalizeOrgNoKey(orgNo));
}

export function removeLoginOrgNo(orgNo: number | string): void {
  const key = normalizeOrgNoKey(orgNo);
  orgNoToOrganizationId.delete(key);
  negativeMissUntil.set(key, Date.now() + NEGATIVE_CACHE_TTL_MS);
}

export function removeLoginOrgNosForOrganizationId(organizationId: string): void {
  const orgId = organizationId.trim();
  if (!orgId) return;
  for (const [orgNo, mapped] of [...orgNoToOrganizationId.entries()]) {
    if (mapped === orgId) {
      orgNoToOrganizationId.delete(orgNo);
      negativeMissUntil.set(orgNo, Date.now() + NEGATIVE_CACHE_TTL_MS);
    }
  }
}

export function clearLoginOrgNoCacheForTests(): void {
  orgNoToOrganizationId.clear();
  negativeMissUntil.clear();
  rateLimitBuckets.clear();
}

function isNegativeMissCached(orgNo: string): boolean {
  const until = negativeMissUntil.get(orgNo);
  if (until == null) return false;
  if (Date.now() >= until) {
    negativeMissUntil.delete(orgNo);
    return false;
  }
  return true;
}

function markNegativeMiss(orgNo: string): void {
  negativeMissUntil.set(orgNo, Date.now() + NEGATIVE_CACHE_TTL_MS);
}

type OrchResolveBody = {
  organizationId?: unknown;
};

/**
 * Resolve public org number to control-plane organization UUID.
 * Hot path: in-memory map (Sync). Miss → orchestrator S2S lookup.
 */
export async function resolveLoginOrganizationId(
  orgNo: string,
  opts?: { fetch?: typeof fetch },
): Promise<LoginOrgResolveResult> {
  const raw = orgNo.trim();
  if (UUID_RE.test(raw)) {
    return { invalid: true };
  }
  if (!ORG_NO_RE.test(raw)) {
    return { invalid: true };
  }

  const cached = lookupLoginOrgNo(raw);
  if (cached) {
    return { organizationId: cached };
  }

  if (isNegativeMissCached(raw)) {
    return { miss: true };
  }

  const fetchFn = opts?.fetch ?? fetch;
  const baseUrl = resolveOrchestratorBaseUrl({ fallback: "http://127.0.0.1:4000" }).replace(
    /\/$/,
    "",
  );
  const token = resolveSatelliteEventServiceToken();
  const url = `${baseUrl}/internal/v1/organizations/by-public-number/${encodeURIComponent(raw)}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetchFn(url, { method: "GET", headers });
  } catch {
    return { miss: true };
  }

  if (res.status === 404) {
    markNegativeMiss(raw);
    return { miss: true };
  }

  if (!res.ok) {
    return { miss: true };
  }

  let body: OrchResolveBody;
  try {
    body = (await res.json()) as OrchResolveBody;
  } catch {
    return { miss: true };
  }

  const organizationId =
    typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  // Require a UUID tenant id from orch; never invent demo-org.
  if (!organizationId || !UUID_RE.test(organizationId)) {
    return { miss: true };
  }

  upsertLoginOrgNo(raw, organizationId);
  return { organizationId };
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

/** In-memory sliding window; replace with Redis for multi-instance pools. */
const rateLimitBuckets = new Map<string, number[]>();

function rateLimitKey(ip: string, orgNo: string): string {
  return `${ip.trim()}|${orgNo.trim()}`;
}

/** Login brute-force guard: IP + orgNo (six-digit codes are enumerable). */
export function assertLoginOrgRateLimit(input: {
  ip: string;
  orgNo: string;
}): { ok: true } | { ok: false } {
  const key = rateLimitKey(input.ip, input.orgNo);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const prior = rateLimitBuckets.get(key) ?? [];
  const inWindow = prior.filter((ts) => ts >= windowStart);

  if (inWindow.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    rateLimitBuckets.set(key, inWindow);
    return { ok: false };
  }

  inWindow.push(now);
  rateLimitBuckets.set(key, inWindow);
  return { ok: true };
}
