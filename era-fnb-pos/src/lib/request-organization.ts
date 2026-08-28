import {
  enterSatelliteTenant,
  resolveSatelliteTenantOrgId,
} from "@era/satellite-kit";

/**
 * Org for this Node request: ALS (session enterWith) first, then process bind.
 * Prefer this over satelliteOrganizationId() for ops stamps on SHARED.
 */
export function requestOrganizationId(): string {
  const id = resolveSatelliteTenantOrgId();
  if (!id) {
    throw new Error("Tenant organizationId unavailable (filter skipped or unbound)");
  }
  return id;
}

/** Bind ALS for the rest of this S2S / request call chain. */
export function enterRequestTenant(organizationId: string): void {
  const trimmed = organizationId.trim();
  if (!trimmed) throw new Error("organizationId required");
  enterSatelliteTenant({ organizationId: trimmed });
}
