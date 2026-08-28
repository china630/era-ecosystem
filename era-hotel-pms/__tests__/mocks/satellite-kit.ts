/** Jest stub — kit barrel pulls jose ESM under CJS Jest. */
const als: { organizationId?: string } = {};

export function satelliteOrganizationId(): string {
  return process.env.ERA_SATELLITE_ORGANIZATION_ID || "test-org";
}

export function enterSatelliteTenant(ctx: { organizationId?: string }): void {
  als.organizationId = ctx.organizationId?.trim() || undefined;
}

export function resolveSatelliteTenantOrgId(): string | null {
  if (process.env.ERA_SKIP_TENANT_FILTER === "1") return null;
  if (als.organizationId) return als.organizationId;
  const bind = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();
  return bind || null;
}

export function getSatelliteTenantContext(): { organizationId?: string } | undefined {
  return als.organizationId ? { organizationId: als.organizationId } : undefined;
}

export function runWithSatelliteTenant<T>(
  ctx: { organizationId?: string },
  fn: () => T,
): T {
  const prev = als.organizationId;
  als.organizationId = ctx.organizationId?.trim() || undefined;
  try {
    return fn();
  } finally {
    als.organizationId = prev;
  }
}

/** Test helper: clear enterWith store between cases. */
export function resetSatelliteTenantAlsForTests(): void {
  als.organizationId = undefined;
}

export class IndustryModuleInactiveError extends Error {
  constructor(message = "Industry module inactive") {
    super(message);
    this.name = "IndustryModuleInactiveError";
  }
}

/** Placement slice — load real kit implementation (CJS dist). */
export {
  exportOrgSlice,
  exportOrgSliceLabSummary,
  importOrgSlice,
  ORG_SLICE_FORMAT_VERSION,
  ORG_SLICE_NOTE_HOTEL_V1,
} from "../../../packages/satellite-kit/dist/placement/slice-export.js";

