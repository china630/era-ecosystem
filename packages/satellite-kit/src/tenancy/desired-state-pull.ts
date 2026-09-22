import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { OrgBindPrisma } from "./organization-bind-core";
import {
  applySatelliteRuntimeConfig,
  type SatelliteRuntimeConfig,
} from "./runtime-config-core";
import { getRuntimeConfigMemory } from "./runtime-config-memory";
import { isFolkloreS2sToken } from "./folklore-s2s-token";
import {
  resolveControlPlaneBearerToken,
  resolveOrchestratorBaseUrl,
} from "./resolve-orchestrator-url";
import { satelliteKeyFromEnv } from "./login-hostname-memory";
import { getRuntimeOrganizationId } from "./organization-bind-runtime";

const DESIRED_STATE_PATH = "/v1/internal/satellites/desired-state";

/** package.json name → SatelliteEndpoint.satelliteKey (when ERA_SATELLITE_KEY unset). */
const PACKAGE_NAME_TO_KEY: Record<string, string> = {
  "era-hotel-pms": "industry_hotel_pms",
  "era-fnb-pos": "industry_fnb_pos",
  "era-clinic": "industry_clinic",
  "era-retail-pos": "industry_retail",
  "era-logistics": "industry_logistics",
  "era-construction": "industry_construction",
  "era-crm": "industry_crm",
  "era-auto-service": "industry_auto_service",
  "era-wholesale": "industry_wholesale",
  "era-bank": "industry_banking",
  "era-bank-dbo": "banking_dbo",
  "era-bank-core": "industry_banking",
  "@era/bank-core-api": "industry_banking",
  "@erafinance/api": "finance_core",
  "erafinance-erp": "finance_core",
};

export type DesiredStatePullResult =
  | { status: "applied"; hash: string }
  | { status: "unchanged"; hash: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string; httpStatus?: number };

let lastAppliedHash: string | null = null;
let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
let reconcileStopped = false;
let reconcileBackoffMs = 0;

export function resetDesiredStatePullForTests(): void {
  lastAppliedHash = null;
  reconcileStopped = false;
  reconcileBackoffMs = 0;
  if (reconcileTimer) {
    clearTimeout(reconcileTimer);
    reconcileTimer = null;
  }
}

export function resolveSatelliteKeyForDesiredState(
  explicit?: string | null,
): string {
  const fromOpt = explicit?.trim();
  if (fromOpt) return fromOpt;
  const fromEnv =
    satelliteKeyFromEnv() ||
    process.env.ERA_SATELLITE_KEY?.trim() ||
    process.env.ERA_FINANCE_SATELLITE_KEY?.trim() ||
    "";
  if (fromEnv) return fromEnv;
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { name?: string };
    const name = pkg.name?.trim() ?? "";
    if (name && PACKAGE_NAME_TO_KEY[name]) return PACKAGE_NAME_TO_KEY[name];
  } catch {
    /* ignore */
  }
  return "";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 32);
}

function processWideConfigFromPayload(
  raw: Record<string, unknown>,
): SatelliteRuntimeConfig {
  const next: SatelliteRuntimeConfig = {};
  if (typeof raw.organizationId === "string" && raw.organizationId.trim()) {
    next.organizationId = raw.organizationId.trim();
  }
  if (typeof raw.orchestratorEventUrl === "string") {
    next.orchestratorEventUrl = raw.orchestratorEventUrl;
  }
  if (typeof raw.publicBaseUrl === "string") {
    next.publicBaseUrl = raw.publicBaseUrl;
  }
  if (Array.isArray(raw.platformSuperAdminEmails)) {
    next.platformSuperAdminEmails = raw.platformSuperAdminEmails.filter(
      (e): e is string => typeof e === "string",
    );
  }
  if (typeof raw.ssoSharedSecret === "string") {
    next.ssoSharedSecret = raw.ssoSharedSecret;
  }
  if (typeof raw.satelliteEventServiceToken === "string") {
    next.satelliteEventServiceToken = raw.satelliteEventServiceToken;
  }
  if (Array.isArray(raw.activeModules)) {
    next.activeModules = raw.activeModules.filter(
      (m): m is string => typeof m === "string",
    );
  }
  if (
    raw.hotelModules &&
    typeof raw.hotelModules === "object" &&
    !Array.isArray(raw.hotelModules)
  ) {
    next.hotelModules = raw.hotelModules as Record<string, boolean>;
  }
  if (
    raw.deploymentTopology === "SHARED" ||
    raw.deploymentTopology === "DEDICATED" ||
    raw.deploymentTopology === "ONPREM"
  ) {
    next.deploymentTopology = raw.deploymentTopology;
  }
  if (typeof raw.edition === "string") {
    next.edition = raw.edition;
  }
  if (typeof raw.vendorBridgesEnabled === "boolean") {
    next.vendorBridgesEnabled = raw.vendorBridgesEnabled;
  }
  // Per-org vendor bridges / fiscal / login hosts stay Sync-push only (Wave 7).
  // Do not copy desiredStateHash / pulledAt from orch — those are local markers.
  return next;
}

function shouldSkipPull(organizationId: string | null, token: string): string | null {
  if (!organizationId) {
    return "no organization bind";
  }
  if (!token || isFolkloreS2sToken(token)) {
    return "folklore or missing service token";
  }
  return null;
}

export type PullDesiredStateOpts = {
  prisma?: OrgBindPrisma | null;
  satelliteKey?: string | null;
  organizationId?: string | null;
  /** Override fetch (tests). */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** When true, skip apply if hash matches last apply / memory. */
  skipIfUnchanged?: boolean;
};

/**
 * GET orch desired-state once and apply process-wide runtime config.
 * Never throws for network / 5xx — caller boot stays up.
 */
export async function pullDesiredStateOnce(
  opts: PullDesiredStateOpts = {},
): Promise<DesiredStatePullResult> {
  const organizationId =
    opts.organizationId?.trim() ||
    getRuntimeOrganizationId() ||
    getRuntimeConfigMemory().organizationId?.trim() ||
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ERA_BANK_ORGANIZATION_ID?.trim() ||
    null;

  const token = resolveControlPlaneBearerToken();
  const skip = shouldSkipPull(organizationId, token);
  if (skip) {
    return { status: "skipped", reason: skip };
  }

  const satelliteKey = resolveSatelliteKeyForDesiredState(opts.satelliteKey);
  if (!satelliteKey) {
    return { status: "skipped", reason: "no satelliteKey" };
  }

  const base = resolveOrchestratorBaseUrl({ fallback: "" }).replace(/\/$/, "");
  if (!base) {
    return { status: "skipped", reason: "no orchestrator URL" };
  }

  const url = new URL(`${base}${DESIRED_STATE_PATH}`);
  url.searchParams.set("satelliteKey", satelliteKey);

  const timeoutMs = opts.timeoutMs ?? 8_000;
  const fetchFn = opts.fetchImpl ?? fetch;

  try {
    const res = await fetchFn(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Organization-Id": organizationId!,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status === 401) {
      return { status: "error", reason: "unauthorized", httpStatus: 401 };
    }
    if (res.status === 404) {
      return { status: "error", reason: "not found", httpStatus: 404 };
    }
    if (!res.ok) {
      return {
        status: "error",
        reason: `http ${res.status}`,
        httpStatus: res.status,
      };
    }

    const body = (await res.json()) as {
      config?: Record<string, unknown>;
      generatedAt?: string;
    };
    const configRaw =
      body.config && typeof body.config === "object" ? body.config : null;
    if (!configRaw) {
      return { status: "error", reason: "empty config" };
    }

    const hash = stableHash(configRaw);
    if (lastAppliedHash == null) {
      const fromMem = getRuntimeConfigMemory().desiredStateHash?.trim();
      if (fromMem) lastAppliedHash = fromMem;
    }
    if (opts.skipIfUnchanged !== false && hash === lastAppliedHash) {
      return { status: "unchanged", hash };
    }

    const processWide = processWideConfigFromPayload(configRaw);
    if (processWide.organizationId) {
      // Dynamic import avoids circular graph with organization-bind-core.
      const { applyOrganizationBind } = await import("./organization-bind-core");
      await applyOrganizationBind({
        organizationId: processWide.organizationId,
        boundBy: "desired-state-pull",
        prisma: opts.prisma ?? null,
      });
    }

    await applySatelliteRuntimeConfig({
      config: {
        ...processWide,
        // Cheap last-success markers (Wave 7) — survive file/DB hydrate.
        desiredStateHash: hash,
        pulledAt: new Date().toISOString(),
      },
      updatedBy: "desired-state-pull",
      prisma: opts.prisma ?? null,
    });

    lastAppliedHash = hash;
    return { status: "applied", hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : "pull failed";
    return { status: "error", reason: message };
  }
}

function defaultPollMs(): number {
  const raw = Number(process.env.ERA_DESIRED_STATE_POLL_MS ?? 60_000);
  if (!Number.isFinite(raw) || raw <= 0) return 0; // 0 = disable loop
  return Math.max(5_000, raw);
}

function withJitter(ms: number): number {
  const jitter = 0.2;
  const factor = 1 + (Math.random() * 2 - 1) * jitter;
  return Math.max(1_000, Math.round(ms * factor));
}

/**
 * Wave 7: jittered poll. 401 stops the loop. 5xx/timeout backoff up to 15 min.
 * Process-wide payload only (not SHARED per-org vendor bridges).
 */
export function startDesiredStateReconcileLoop(opts: {
  prisma?: OrgBindPrisma | null;
  satelliteKey?: string | null;
  fetchImpl?: typeof fetch;
}): void {
  if (reconcileTimer || reconcileStopped) return;
  const baseMs = defaultPollMs();
  if (baseMs <= 0) return;

  const tick = async () => {
    if (reconcileStopped) return;
    const delayBase = reconcileBackoffMs > 0 ? reconcileBackoffMs : baseMs;
    reconcileTimer = setTimeout(() => {
      void (async () => {
        const result = await pullDesiredStateOnce({
          prisma: opts.prisma ?? null,
          satelliteKey: opts.satelliteKey,
          fetchImpl: opts.fetchImpl,
          skipIfUnchanged: true,
        });

        if (result.status === "error" && result.httpStatus === 401) {
          reconcileStopped = true;
          console.error(
            "[desired-state] reconcile stopped: 401 unauthorized (fix ENV_FILE / Sync token)",
          );
          return;
        }

        if (
          result.status === "error" &&
          (result.httpStatus == null ||
            result.httpStatus >= 500 ||
            result.reason.includes("timeout") ||
            result.reason.includes("fetch"))
        ) {
          reconcileBackoffMs = Math.min(
            15 * 60_000,
            Math.max(baseMs * 2, reconcileBackoffMs * 2 || baseMs * 2),
          );
        } else if (result.status === "applied" || result.status === "unchanged") {
          reconcileBackoffMs = 0;
        } else if (result.status === "error" && result.httpStatus === 404) {
          // Endpoint not registered yet — soft backoff, do not stop.
          reconcileBackoffMs = Math.min(15 * 60_000, Math.max(baseMs * 2, reconcileBackoffMs || baseMs));
        }

        if (!reconcileStopped) {
          void tick();
        }
      })();
    }, withJitter(delayBase));
    // Allow process to exit without waiting on the timer in Node.
    if (typeof reconcileTimer === "object" && reconcileTimer && "unref" in reconcileTimer) {
      (reconcileTimer as NodeJS.Timeout).unref?.();
    }
  };

  void tick();
}

export function shouldPullDesiredStateOnBoot(explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  if (process.env.ERA_DESIRED_STATE_PULL === "0") return false;
  if (process.env.ERA_DESIRED_STATE_PULL === "1") return true;
  return process.env.ERA_IN_DOCKER === "1";
}
