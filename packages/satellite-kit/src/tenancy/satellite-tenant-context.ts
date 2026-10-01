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

/**
 * Next.js drops `enterWith` across `await`. After that, the org is read from
 * the request header `x-era-organization-id` (middleware stamps the session)
 * and from the Next request store written by `enterSatelliteTenant`.
 * Outside a request both reads miss and the process bind remains the source.
 */
const orgByWorkStore = new WeakMap<object, string>();

function currentWorkStore(): object | undefined {
  try {
    const dynamicRequire = eval("require") as NodeRequire;
    const mod = dynamicRequire(
      "next/dist/server/app-render/work-unit-async-storage.external",
    ) as { workUnitAsyncStorage?: { getStore?: () => object | undefined } };
    const store = mod.workUnitAsyncStorage?.getStore?.();
    if (store && typeof store === "object") return store;
  } catch {
    return undefined;
  }
  return undefined;
}

function organizationIdFromNextRequest(): string | undefined {
  try {
    const dynamicRequire = eval("require") as NodeRequire;
    const { headers } = dynamicRequire("next/headers") as {
      headers: () => { get?: (name: string) => string | null } | Promise<unknown>;
    };
    const result = headers();
    if (!result || typeof (result as { then?: unknown }).then === "function") return undefined;
    const bag = result as { get?: (name: string) => string | null };
    const id = bag.get?.("x-era-organization-id")?.trim();
    return id || undefined;
  } catch {
    return undefined;
  }
}

function peekRequestOrganizationId(): string | undefined {
  const store = currentWorkStore();
  if (!store) return undefined;
  return orgByWorkStore.get(store)?.trim() || undefined;
}

function rememberRequestOrganizationId(organizationId: string): void {
  const store = currentWorkStore();
  if (store) orgByWorkStore.set(store, organizationId);
}

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
  const id = ctx.organizationId?.trim();
  if (id) rememberRequestOrganizationId(id);
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
  const fromRequest = organizationIdFromNextRequest();
  if (fromRequest) {
    return { mode: "apply", organizationId: requireUsableOrgId(fromRequest) };
  }
  const remembered = peekRequestOrganizationId();
  if (remembered) {
    return { mode: "apply", organizationId: requireUsableOrgId(remembered) };
  }
  const resolved = resolveSatelliteOrganizationId();
  return { mode: "apply", organizationId: requireUsableOrgId(resolved.organizationId) };
}

/** Org id the tenant filter applies. Unbound throws. */
export function resolveSatelliteTenantOrgId(): string {
  return resolveSatelliteTenantFilter().organizationId;
}
