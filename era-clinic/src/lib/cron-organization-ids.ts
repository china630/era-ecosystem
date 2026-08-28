import { fetchPoolOrganizationIdsFromOrch } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

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

export function fetchClinicPoolOrganizationIds(): Promise<string[]> {
  return fetchPoolOrganizationIdsFromOrch({
    satelliteKey: "industry_clinic",
  });
}
