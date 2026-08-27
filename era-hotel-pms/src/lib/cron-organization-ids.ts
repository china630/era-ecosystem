import { fetchPoolOrganizationIdsFromOrch } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

/**
 * SHARED pool cron discover: DISTINCT staff User.organizationId.
 * Orgs with no User rows are skipped until first staff or ERA_CRON_ORGANIZATION_IDS.
 * Called outside ALS (brief ERA_SKIP_TENANT_FILTER for this read only).
 */
export async function listCronOrganizationIdsFromDb(): Promise<string[]> {
  const prev = process.env.ERA_SKIP_TENANT_FILTER;
  process.env.ERA_SKIP_TENANT_FILTER = "1";
  try {
    const rows = await prisma.user.findMany({
      distinct: ["organizationId"],
      select: { organizationId: true },
    });
    return [
      ...new Set(
        rows
          .map((r) => r.organizationId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
  } finally {
    if (prev === undefined) delete process.env.ERA_SKIP_TENANT_FILTER;
    else process.env.ERA_SKIP_TENANT_FILTER = prev;
  }
}

/** Orch SoR pool members for this hotel process URL. */
export function fetchHotelPoolOrganizationIds(): Promise<string[]> {
  return fetchPoolOrganizationIdsFromOrch({
    satelliteKey: "industry_hotel_pms",
  });
}
