import {
  isProductionNodeEnv,
  isSentinelOrganizationId,
} from "./organization-id-guard";

export type OrganizationBindSource =
  | "runtime"
  | "file"
  | "db"
  | "env"
  | "fallback";

let runtimeOrganizationId: string | null = null;

function assertNotSentinelBind(id: string): void {
  if (isSentinelOrganizationId(id)) {
    throw new SatelliteOrganizationUnboundError(
      `Refusing sentinel organizationId "${id}"`,
    );
  }
}

export function setRuntimeOrganizationId(organizationId: string | null): void {
  const id = organizationId?.trim() || null;
  if (id) assertNotSentinelBind(id);
  runtimeOrganizationId = id;
  if (id) {
    process.env.ERA_SATELLITE_ORGANIZATION_ID = id;
  }
}

export function getRuntimeOrganizationId(): string | null {
  return runtimeOrganizationId;
}

export class SatelliteOrganizationUnboundError extends Error {
  readonly code = "SATELLITE_ORG_UNBOUND";

  constructor(message = "Satellite organizationId is not bound (production refuses demo-org fallback)") {
    super(message);
    this.name = "SatelliteOrganizationUnboundError";
  }
}

/**
 * Memory + env only (no fs). Safe for Next webpack / Prisma extension import graph.
 * File/DB hydrate happens in onSatelliteBoot.
 */
export function resolveSatelliteOrganizationId(opts?: {
  allowFallback?: boolean;
}): {
  organizationId: string;
  source: OrganizationBindSource;
} {
  if (runtimeOrganizationId) {
    assertNotSentinelBind(runtimeOrganizationId);
    return { organizationId: runtimeOrganizationId, source: "runtime" };
  }
  const fromEnv =
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ||
    process.env.ERA_BANK_ORGANIZATION_ID?.trim() ||
    process.env.ORGANIZATION_ID?.trim() ||
    "";
  if (fromEnv) {
    assertNotSentinelBind(fromEnv);
    return { organizationId: fromEnv, source: "env" };
  }
  if (opts?.allowFallback || !isProductionNodeEnv()) {
    return { organizationId: "demo-org", source: "fallback" };
  }
  throw new SatelliteOrganizationUnboundError();
}

export function resetOrganizationBindRuntimeForTests(): void {
  runtimeOrganizationId = null;
}
