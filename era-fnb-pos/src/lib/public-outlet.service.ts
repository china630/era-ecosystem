import {
  CronOrganizationListError,
  SatelliteOrganizationUnboundError,
  fetchPoolOrganizationIdsFromOrch,
  listCronOrganizationIds,
  runWithSatelliteTenant,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

/** Orch SoR pool members for this F&B process URL. */
export function fetchFnbPoolOrganizationIds(): Promise<string[]> {
  return fetchPoolOrganizationIdsFromOrch({ satelliteKey: "industry_fnb_pos" });
}

export function isOutletPoolUnavailable(err: unknown): boolean {
  return (
    err instanceof CronOrganizationListError || err instanceof SatelliteOrganizationUnboundError
  );
}

/**
 * `publicSlug` is unique across the pool. Orgs come from the orch registry
 * (SHARED) or the process org (DEDICATED / ONPREM); each lookup runs with the
 * tenant filter on. The caller enters the returned outlet's org before reading the menu.
 */
export async function findActiveOutletByPublicSlug(slug: string) {
  const publicSlug = slug.trim();
  if (!publicSlug) return null;
  const organizationIds = await listCronOrganizationIds(fetchFnbPoolOrganizationIds);
  for (const organizationId of organizationIds) {
    const outlet = await runWithSatelliteTenant({ organizationId }, () =>
      prisma.outlet.findFirst({ where: { publicSlug, active: true } }),
    );
    if (outlet) return outlet;
  }
  return null;
}
