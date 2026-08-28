import { prisma } from "@/lib/prisma";
import {
  enterSatelliteTenant,
  resolveSatelliteTenantOrgId,
  satelliteOrganizationId,
} from "@era/satellite-kit";
import type { ElektrawebBridgeSyncPayload } from "@era/satellite-kit";
import { ROLE_CODES, type RoleCode } from "@/lib/auth/permissions";

const BRIDGE_ROLES = new Set<string>([
  ROLE_CODES.HOTEL_ADMIN,
  ROLE_CODES.MANAGER,
  ROLE_CODES.RECEPTIONIST,
  ROLE_CODES.NIGHT_AUDITOR,
]);

export type ElektrawebBridgePolicyRow = {
  organizationId: string;
  inboundEnabled: boolean;
  writeEnabled: boolean;
  elektrawebHotelId: number | null;
  spaDepId: number | null;
  spaCurrencyId: number | null;
  walkinResId: string | null;
  walkinResNameId: string | null;
};

/** Pool-wide kill switch — not a per-org Nafta id. */
export function isElektrawebBridgeEnabled(): boolean {
  return process.env.ELEKTRAWEB_BRIDGE_ENABLED === "1";
}

export function roleMayUseBridge(role: string): boolean {
  return BRIDGE_ROLES.has(role as RoleCode) || role === "DIRECTOR" || role === "OWNER";
}

export async function getElektrawebBridgePolicy(
  organizationId: string,
): Promise<ElektrawebBridgePolicyRow | null> {
  const row = await prisma.elektrawebBridgePolicy.findUnique({
    where: { organizationId },
  });
  return row;
}

export async function upsertElektrawebBridgePolicy(
  organizationId: string,
  policy: ElektrawebBridgeSyncPayload,
): Promise<ElektrawebBridgePolicyRow> {
  return prisma.elektrawebBridgePolicy.upsert({
    where: { organizationId },
    create: {
      organizationId,
      inboundEnabled: policy.inboundEnabled,
      writeEnabled: policy.writeEnabled,
      elektrawebHotelId: policy.elektrawebHotelId ?? null,
      spaDepId: policy.spaDepId ?? null,
      spaCurrencyId: policy.spaCurrencyId ?? null,
      walkinResId: policy.walkinResId ?? null,
      walkinResNameId: policy.walkinResNameId ?? null,
    },
    update: {
      inboundEnabled: policy.inboundEnabled,
      writeEnabled: policy.writeEnabled,
      elektrawebHotelId: policy.elektrawebHotelId ?? null,
      spaDepId: policy.spaDepId ?? null,
      spaCurrencyId: policy.spaCurrencyId ?? null,
      walkinResId: policy.walkinResId ?? null,
      walkinResNameId: policy.walkinResNameId ?? null,
    },
  });
}

export function isPolicyWriteEnabled(policy: ElektrawebBridgePolicyRow | null): boolean {
  return !!policy?.inboundEnabled && !!policy?.writeEnabled && isElektrawebBridgeEnabled();
}

export function isPolicyInboundEnabled(policy: ElektrawebBridgePolicyRow | null): boolean {
  return !!policy?.inboundEnabled && isElektrawebBridgeEnabled();
}

export function requirePolicyHotelId(policy: ElektrawebBridgePolicyRow): number {
  if (!policy.elektrawebHotelId || policy.elektrawebHotelId <= 0) {
    throw new Error(`Elektraweb hotel id not configured for org ${policy.organizationId}`);
  }
  return policy.elektrawebHotelId;
}

export function getPolicySpaDepId(policy: ElektrawebBridgePolicyRow): number {
  return policy.spaDepId && policy.spaDepId > 0 ? policy.spaDepId : 133387;
}

export function getPolicySpaCurrencyId(policy: ElektrawebBridgePolicyRow): number {
  return policy.spaCurrencyId && policy.spaCurrencyId > 0 ? policy.spaCurrencyId : 10;
}

export function getPolicyWalkinFolio(
  policy: ElektrawebBridgePolicyRow,
): { resId: string; resNameId: string } | null {
  const resId = policy.walkinResId?.trim();
  const resNameId = policy.walkinResNameId?.trim();
  if (!resId || !resNameId) return null;
  return { resId, resNameId };
}

export function assertHotelIdMatchesPolicy(
  policy: ElektrawebBridgePolicyRow,
  hotelId: number | string | null | undefined,
): void {
  const expected = requirePolicyHotelId(policy);
  const actual = Number(hotelId);
  if (!Number.isFinite(actual) || actual !== expected) {
    throw new Error(
      `Elektraweb HOTELID mismatch: got ${hotelId ?? "missing"}, expected ${expected} for org ${policy.organizationId}`,
    );
  }
}

/** Enter ALS tenant for the rest of this Node request. */
export function enterBridgeTenant(organizationId: string): void {
  enterSatelliteTenant({ organizationId });
}

/** Appliance fallback: process bind org (DEDICATED / ONPREM). */
export function getProcessBoundOrganizationId(): string {
  return satelliteOrganizationId();
}

/**
 * Org for EW ingest create/update stamps: ALS (JWT/session) first, then process bind.
 * Prefer over satelliteOrganizationId() so SHARED pool does not stamp the wrong hotel.
 */
export function bridgeRequestOrganizationId(): string {
  const als = resolveSatelliteTenantOrgId();
  if (als) return als;
  return getProcessBoundOrganizationId();
}

/**
 * Assert HOTELID against the current request tenant policy (ALS or process bind).
 * Call after enterBridgeTenant / authenticateBridgeRequest.
 */
export async function assertHotelIdMatches(
  hotelId: number | string | null | undefined,
): Promise<void> {
  const orgId = resolveSatelliteTenantOrgId() ?? getProcessBoundOrganizationId();
  const policy = await getElektrawebBridgePolicy(orgId);
  if (!policy || !isPolicyInboundEnabled(policy)) {
    const err = new Error(
      `Elektraweb bridge policy missing or inbound disabled for org ${orgId}`,
    );
    (err as Error & { status?: number }).status = 409;
    throw err;
  }
  try {
    assertHotelIdMatchesPolicy(policy, hotelId);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    (err as Error & { status?: number }).status = 409;
    throw err;
  }
}
