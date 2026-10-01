import { AsyncLocalStorage } from "node:async_hooks";
import {
  SatelliteOrganizationUnboundError,
  resolveSatelliteOrganizationId,
} from "./organization-bind-runtime";
import { isSentinelOrganizationId } from "./organization-id-guard";

export type SatelliteTenantContext = {
  organizationId?: string;
};

export type SatelliteTenantFilter = { mode: "apply"; organizationId: string };

const als = new AsyncLocalStorage<SatelliteTenantContext>();

export function runWithSatelliteTenant<T>(
  ctx: SatelliteTenantContext,
  fn: () => T,
): T {
  return als.run(ctx, fn);
}

/**
 * Bind tenant for the remainder of the current async call chain (Node ALS).
 * Use in route handlers after resolving org from JWT / session / S2S body —
 * Edge middleware cannot hold ALS for the Node route.
 */
export function enterSatelliteTenant(ctx: SatelliteTenantContext): void {
  als.enterWith(ctx);
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
 * Org for Prisma tenant extension. There is no unfiltered mode: lookups by a
 * pool-unique key iterate registry orgs, each inside `runWithSatelliteTenant`.
 * Unbound / sentinel → throw (fail-closed). Never return empty and continue.
 */
export function resolveSatelliteTenantFilter(): SatelliteTenantFilter {
  const ctx = als.getStore();
  if (ctx?.organizationId?.trim()) {
    return { mode: "apply", organizationId: requireUsableOrgId(ctx.organizationId) };
  }
  const resolved = resolveSatelliteOrganizationId();
  return { mode: "apply", organizationId: requireUsableOrgId(resolved.organizationId) };
}

/** Org id the tenant filter applies. Unbound throws. */
export function resolveSatelliteTenantOrgId(): string {
  return resolveSatelliteTenantFilter().organizationId;
}
