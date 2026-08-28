import { prisma } from "@/lib/prisma";
import type { ClinicCutoverSyncPayload } from "@era/satellite-kit";

export type ClinicCutoverPolicyRow = {
  organizationId: string;
  elektrawebDualRun: boolean;
  hotelOrganizationId: string | null;
};

export function dualRunEnabled(
  policy: ClinicCutoverPolicyRow | null | undefined,
): boolean {
  return !!policy?.elektrawebDualRun;
}

export async function getClinicCutoverPolicy(
  organizationId: string,
): Promise<ClinicCutoverPolicyRow | null> {
  return prisma.clinicCutoverPolicy.findUnique({ where: { organizationId } });
}

export async function upsertClinicCutoverPolicy(
  organizationId: string,
  policy: ClinicCutoverSyncPayload,
): Promise<ClinicCutoverPolicyRow> {
  return prisma.clinicCutoverPolicy.upsert({
    where: { organizationId },
    create: {
      organizationId,
      elektrawebDualRun: policy.elektrawebDualRun,
      hotelOrganizationId: policy.hotelOrganizationId ?? null,
    },
    update: {
      elektrawebDualRun: policy.elektrawebDualRun,
      hotelOrganizationId: policy.hotelOrganizationId ?? null,
    },
  });
}

/** Resolve clinic org for cutover: explicit → ALS. Fail-closed (no process bind). */
export function resolveClinicCutoverOrgId(explicit?: string | null): string {
  if (explicit?.trim()) return explicit.trim();
  // Lazy require — keeps pure unit tests free of jose ESM via kit barrel.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const kit = require("@era/satellite-kit") as typeof import("@era/satellite-kit");
  const fromAls = kit.resolveSatelliteTenantOrgId();
  if (fromAls) return fromAls;
  throw new Error(
    "Clinic cutover organizationId unavailable (ALS/session required on SHARED)",
  );
}

export async function isClinicElektrawebDualRun(
  organizationId?: string | null,
): Promise<boolean> {
  const orgId = resolveClinicCutoverOrgId(organizationId);
  const policy = await getClinicCutoverPolicy(orgId);
  return dualRunEnabled(policy);
}

export async function getClinicHotelOrganizationId(
  organizationId?: string | null,
): Promise<string | null> {
  const orgId = resolveClinicCutoverOrgId(organizationId);
  const policy = await getClinicCutoverPolicy(orgId);
  return policy?.hotelOrganizationId ?? null;
}
