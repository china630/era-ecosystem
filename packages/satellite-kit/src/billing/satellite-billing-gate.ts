import {
  resolveControlPlaneBearerToken,
  resolveOrchestratorBaseUrl,
} from "../tenancy/resolve-orchestrator-url";

/**
 * Billing SOFT/HARD enforcement for industry satellites. The matrix lives in the
 * orchestrator (`POST /internal/v1/entitlements/validate`); the kit only asks and caches.
 * ADR: docs/adr/billing-enforcement-satellites.md
 */
export type SatelliteBillingStatus = "ACTIVE" | "SOFT_BLOCK" | "HARD_BLOCK";

export type SatelliteBillingCheck = {
  organizationId: string;
  method: string;
  path: string;
};

export type SatelliteBillingGate = (input: SatelliteBillingCheck) => Promise<unknown>;

/** 402 from the orchestrator matrix, or 503 when a write cannot be checked. */
export class SatelliteBillingBlockedError extends Error {
  readonly status: number;
  readonly code: string;
  readonly billingStatus: SatelliteBillingStatus | null;

  constructor(opts: {
    code: string;
    message: string;
    status?: number;
    billingStatus?: SatelliteBillingStatus | null;
  }) {
    super(opts.message);
    this.name = "SatelliteBillingBlockedError";
    this.code = opts.code;
    this.status = opts.status ?? 402;
    this.billingStatus = opts.billingStatus ?? null;
  }
}

export function isSatelliteBillingBlockedError(
  err: unknown,
): err is SatelliteBillingBlockedError {
  return (
    err instanceof SatelliteBillingBlockedError ||
    (err instanceof Error && err.name === "SatelliteBillingBlockedError")
  );
}

type ValidateResponse = {
  allowed: boolean;
  billingStatus: SatelliteBillingStatus;
  code?: string;
  message?: string;
  httpStatus?: number;
};

type CacheEntry = { status: SatelliteBillingStatus; at: number };

/** ACTIVE answers skip the orchestrator call for this long. */
const ACTIVE_TTL_MS = 60_000;
/** Last known status is trusted this long when the orchestrator is unreachable. */
const STALE_FALLBACK_MS = 15 * 60_000;
const VALIDATE_TIMEOUT_MS = 2_500;

const statusCache = new Map<string, CacheEntry>();

/** Tests only. */
export function resetSatelliteBillingCacheForTests(): void {
  statusCache.clear();
}

/** Tests only: seed the last known status for an org. */
export function seedSatelliteBillingCacheForTests(
  organizationId: string,
  status: SatelliteBillingStatus,
  ageMs = 0,
): void {
  statusCache.set(organizationId, { status, at: Date.now() - ageMs });
}

/**
 * Off only outside production: `ERA_BILLING_ENFORCEMENT=off`, the dev module
 * unlock, or jest (`NODE_ENV=test`) unless `ERA_BILLING_ENFORCEMENT=on`.
 */
export function satelliteBillingEnforcementDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const flag = process.env.ERA_BILLING_ENFORCEMENT?.trim().toLowerCase();
  if (flag === "on") return false;
  if (flag === "off") return true;
  if (process.env.ERA_DEV_UNLOCK_ALL_MODULES === "1") return true;
  return process.env.NODE_ENV === "test";
}

function isReadMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

/** Mirrors the orchestrator matrix: login, logout, password change stay open. */
function isSessionMaintenancePath(path: string): boolean {
  return path.startsWith("/api/auth/");
}

function isBillingStatus(v: unknown): v is SatelliteBillingStatus {
  return v === "ACTIVE" || v === "SOFT_BLOCK" || v === "HARD_BLOCK";
}

async function callValidate(input: SatelliteBillingCheck): Promise<ValidateResponse | null> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = resolveControlPlaneBearerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(
      `${resolveOrchestratorBaseUrl()}/internal/v1/entitlements/validate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          organizationId: input.organizationId,
          method: input.method,
          path: input.path,
        }),
        signal: AbortSignal.timeout(VALIDATE_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<ValidateResponse>;
    if (typeof body.allowed !== "boolean" || !isBillingStatus(body.billingStatus)) {
      return null;
    }
    return body as ValidateResponse;
  } catch {
    return null;
  }
}

function blockedFrom(res: ValidateResponse): SatelliteBillingBlockedError {
  return new SatelliteBillingBlockedError({
    code:
      res.code ??
      (res.billingStatus === "HARD_BLOCK"
        ? "BILLING_HARD_BLOCK_READ_ONLY"
        : "BILLING_SOFT_BLOCK_EXPORTS"),
    message: res.message ?? `Billing ${res.billingStatus}`,
    status: res.httpStatus ?? 402,
    billingStatus: res.billingStatus,
  });
}

/**
 * Throws `SatelliteBillingBlockedError` when the orchestrator denies the call.
 * Orchestrator down: last known status (≤15 min) decides; with no cache, reads
 * pass and writes get 503 so an outage never reopens posting for a blocked org.
 */
export async function assertSatelliteBillingAllows(
  input: SatelliteBillingCheck,
): Promise<SatelliteBillingStatus> {
  if (satelliteBillingEnforcementDisabled()) return "ACTIVE";
  const org = input.organizationId.trim();
  const now = Date.now();
  const cached = statusCache.get(org);
  if (cached?.status === "ACTIVE" && now - cached.at < ACTIVE_TTL_MS) {
    return "ACTIVE";
  }

  const res = await callValidate({ ...input, organizationId: org });
  if (res) {
    statusCache.set(org, { status: res.billingStatus, at: now });
    if (!res.allowed) throw blockedFrom(res);
    return res.billingStatus;
  }

  const exempt = isReadMethod(input.method) || isSessionMaintenancePath(input.path);
  if (cached && now - cached.at < STALE_FALLBACK_MS) {
    if (cached.status === "HARD_BLOCK" && !exempt) {
      throw new SatelliteBillingBlockedError({
        code: "BILLING_HARD_BLOCK_READ_ONLY",
        message: "Billing HARD_BLOCK: system is in read-only mode until invoice payment.",
        billingStatus: "HARD_BLOCK",
      });
    }
    return cached.status;
  }
  if (exempt) return "ACTIVE";
  throw new SatelliteBillingBlockedError({
    code: "BILLING_STATUS_UNAVAILABLE",
    message: "Billing status unavailable: control plane unreachable, writes are paused.",
    status: 503,
  });
}

/**
 * Banner data: the org status from a GET the matrix always allows.
 * `null` when the orchestrator is unreachable and nothing is cached.
 */
export async function resolveSatelliteBillingStatus(
  organizationId: string,
): Promise<SatelliteBillingStatus | null> {
  if (satelliteBillingEnforcementDisabled()) return "ACTIVE";
  const org = organizationId.trim();
  const now = Date.now();
  const cached = statusCache.get(org);
  if (cached?.status === "ACTIVE" && now - cached.at < ACTIVE_TTL_MS) return "ACTIVE";
  const res = await callValidate({
    organizationId: org,
    method: "GET",
    path: "/api/platform/billing-status",
  });
  if (res) {
    statusCache.set(org, { status: res.billingStatus, at: now });
    return res.billingStatus;
  }
  if (cached && now - cached.at < STALE_FALLBACK_MS) return cached.status;
  return null;
}
