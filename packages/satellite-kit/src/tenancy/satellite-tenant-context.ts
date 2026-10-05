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

type TenantState = {
  als: AsyncLocalStorage<SatelliteTenantContext>;
  orgByWorkStore: WeakMap<object, string>;
};

/**
 * One store per process. Next bundles this module separately for
 * instrumentation and each route, and the dev Prisma client cached on
 * globalThis keeps the copy that created it.
 */
const TENANT_STATE_KEY = Symbol.for("era.satellite-kit.tenant-state");
const tenantState: TenantState = ((globalThis as Record<symbol, unknown>)[TENANT_STATE_KEY] as
  | TenantState
  | undefined) ?? {
  als: new AsyncLocalStorage<SatelliteTenantContext>(),
  orgByWorkStore: new WeakMap<object, string>(),
};
(globalThis as Record<symbol, unknown>)[TENANT_STATE_KEY] = tenantState;

const als = tenantState.als;

/**
 * Next.js drops `enterWith` across `await`. `enterSatelliteTenant` also
 * remembers the org on the Next request store, and the filter reads that.
 * The process bind is used only when there is no request (cron, workers).
 * A request with no entered org throws.
 */
const orgByWorkStore = tenantState.orgByWorkStore;

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
 * Inside a Next request the org is ALS or the store written by
 * `enterSatelliteTenant`; missing → throw. The process bind is only outside a request.
 */
export function resolveSatelliteTenantFilter(): SatelliteTenantFilter {
  const ctx = als.getStore();
  if (ctx?.organizationId?.trim()) {
    return { mode: "apply", organizationId: requireUsableOrgId(ctx.organizationId) };
  }
  const remembered = peekRequestOrganizationId();
  if (remembered) {
    return { mode: "apply", organizationId: requireUsableOrgId(remembered) };
  }
  if (currentWorkStore()) {
    throw new SatelliteOrganizationUnboundError(
      "Request has no organization. Enter the tenant from the session; the process bind is not a request fallback.",
    );
  }
  const resolved = resolveSatelliteOrganizationId();
  return { mode: "apply", organizationId: requireUsableOrgId(resolved.organizationId) };
}

/** Org id the tenant filter applies. Unbound throws. */
export function resolveSatelliteTenantOrgId(): string {
  return resolveSatelliteTenantFilter().organizationId;
}

/**
 * Org already on this call: ALS or the Next request store.
 * Missing → undefined. Never the process bind and never the request header.
 * A service caller passes the incoming request to `organizationIdOnIncomingRequest`.
 */
export function peekSatelliteRequestOrganizationId(): string | undefined {
  const ctx = als.getStore();
  if (ctx?.organizationId?.trim()) {
    return requireUsableOrgId(ctx.organizationId);
  }
  const remembered = peekRequestOrganizationId();
  if (remembered) return requireUsableOrgId(remembered);
  return undefined;
}

/**
 * Org for a service HTTP call. The incoming `x-era-organization-id` wins,
 * then ALS / the Next request store. Never the JSON body and never the process bind.
 */
export function organizationIdOnIncomingRequest(request: {
  headers: { get(name: string): string | null };
}): string | undefined {
  const header = request.headers.get("x-era-organization-id")?.trim() ?? "";
  if (header) {
    if (isSentinelOrganizationId(header)) return undefined;
    return header;
  }
  return peekSatelliteRequestOrganizationId();
}
