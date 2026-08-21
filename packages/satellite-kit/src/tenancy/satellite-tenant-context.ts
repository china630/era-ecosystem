import { AsyncLocalStorage } from "node:async_hooks";
import {
  SatelliteOrganizationUnboundError,
  resolveSatelliteOrganizationId,
} from "./organization-bind-runtime";
import { isSentinelOrganizationId } from "./organization-id-guard";

export type SatelliteTenantContext = {
  organizationId?: string;
  skipTenantFilter?: boolean;
};

export type SatelliteTenantFilter =
  | { mode: "skip" }
  | { mode: "apply"; organizationId: string };

const als = new AsyncLocalStorage<SatelliteTenantContext>();

export function runWithSatelliteTenant<T>(
  ctx: SatelliteTenantContext,
  fn: () => T,
): T {
  return als.run(ctx, fn);
}

export function getSatelliteTenantContext(): SatelliteTenantContext | undefined {
  return als.getStore();
}

function requireUsableOrgId(id: string): string {
  const trimmed = id.trim();
  if (isSentinelOrganizationId(trimmed)) {
    throw new SatelliteOrganizationUnboundError(
      `Satellite organizationId is sentinel or empty ("${trimmed}")`,
    );
  }
  return trimmed;
}

/**
 * Org for Prisma tenant extension.
 * `skip` = seeds (`ERA_SKIP_TENANT_FILTER=1` or ALS skip) — unfiltered on purpose.
 * Unbound / sentinel → throw (fail-closed). Never return empty and continue.
 */
export function resolveSatelliteTenantFilter(): SatelliteTenantFilter {
  if (process.env.ERA_SKIP_TENANT_FILTER === "1") return { mode: "skip" };
  const ctx = als.getStore();
  if (ctx?.skipTenantFilter) return { mode: "skip" };
  if (ctx?.organizationId?.trim()) {
    return { mode: "apply", organizationId: requireUsableOrgId(ctx.organizationId) };
  }
  const resolved = resolveSatelliteOrganizationId();
  return { mode: "apply", organizationId: requireUsableOrgId(resolved.organizationId) };
}

/**
 * Org id when the filter applies; `null` only for explicit skip.
 * Unbound throws — do not treat null as "no tenant".
 */
export function resolveSatelliteTenantOrgId(): string | null {
  const filter = resolveSatelliteTenantFilter();
  if (filter.mode === "skip") return null;
  return filter.organizationId;
}
