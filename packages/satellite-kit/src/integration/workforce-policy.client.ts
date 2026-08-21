/**
 * Orchestrator workforce policy — hire mode for industry satellites (v3 Plan C).
 */

import { resolveSatelliteOrganizationId } from "../tenancy/organization-bind-core";
import {
  resolveOrchestratorBaseUrl,
  resolveSatelliteEventServiceToken,
} from "../tenancy/resolve-orchestrator-url";

export type WorkforceHireMode = "cp_workforce" | "disabled";

export type WorkforcePolicyResult = {
  hireMode: WorkforceHireMode;
  workforceModuleActive: boolean;
  hrModuleActive: boolean;
  satelliteEntitled: boolean;
};

export type WorkforcePolicyClientOptions = {
  orchestratorUrl?: string;
  serviceToken?: string;
  organizationId?: string;
  enabled?: boolean;
};

type CacheEntry = { at: number; value: WorkforcePolicyResult };

const POLICY_TTL_MS = 60_000;
const policyCache = new Map<string, CacheEntry>();

function policyEnabled(opts?: WorkforcePolicyClientOptions): boolean {
  if (opts?.enabled === false) return false;
  const flag = process.env.ERA_WORKFORCE_POLICY_ENABLED;
  if (flag != null && flag.toLowerCase() === "false") return false;
  return true;
}

function baseUrl(opts?: WorkforcePolicyClientOptions): string {
  if (opts?.orchestratorUrl?.trim()) {
    return opts.orchestratorUrl.trim().replace(/\/$/, "");
  }
  return resolveOrchestratorBaseUrl({ fallback: "http://127.0.0.1:4000" });
}

function serviceToken(opts?: WorkforcePolicyClientOptions): string | undefined {
  return (
    opts?.serviceToken?.trim() ||
    resolveSatelliteEventServiceToken() ||
    process.env.MDM_INTERNAL_SERVICE_TOKEN?.trim() ||
    undefined
  );
}

function organizationId(opts?: WorkforcePolicyClientOptions): string | undefined {
  const explicit = opts?.organizationId?.trim();
  if (explicit) return explicit;
  const { organizationId: id, source } = resolveSatelliteOrganizationId({
    allowFallback: true,
  });
  return source === "fallback" ? undefined : id;
}

function defaultDisabled(): WorkforcePolicyResult {
  return {
    hireMode: "disabled",
    workforceModuleActive: false,
    hrModuleActive: false,
    satelliteEntitled: false,
  };
}

/** Fetch workforce hire policy from orchestrator (60s TTL cache). */
export async function fetchWorkforcePolicy(
  satelliteKey: string,
  opts?: WorkforcePolicyClientOptions,
): Promise<WorkforcePolicyResult> {
  const orgId = organizationId(opts);
  const cacheKey = `${orgId ?? "none"}:${satelliteKey}`;
  const cached = policyCache.get(cacheKey);
  if (cached && Date.now() - cached.at < POLICY_TTL_MS) {
    return cached.value;
  }

  if (!policyEnabled(opts)) {
    return defaultDisabled();
  }

  const token = serviceToken(opts);
  if (!token || !orgId) {
    return cached?.value ?? defaultDisabled();
  }

  const q = new URLSearchParams({
    satelliteKey,
    organizationId: orgId,
  });
  const url = `${baseUrl(opts)}/platform/v1/workforce/policy?${q}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-service-token": token,
        "X-Organization-Id": orgId,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`workforce policy ${res.status}`);
    }
    const body = (await res.json()) as WorkforcePolicyResult & {
      hireMode?: string;
    };
    const result: WorkforcePolicyResult = {
      hireMode: body.hireMode === "cp_workforce" ? "cp_workforce" : "disabled",
      workforceModuleActive: Boolean(body.workforceModuleActive),
      hrModuleActive: Boolean(body.hrModuleActive),
      satelliteEntitled: Boolean(body.satelliteEntitled),
    };
    policyCache.set(cacheKey, { at: Date.now(), value: result });
    return result;
  } catch {
    return cached?.value ?? defaultDisabled();
  }
}

export function isCpWorkforceHireMode(policy: WorkforcePolicyResult): boolean {
  return policy.hireMode === "cp_workforce";
}
