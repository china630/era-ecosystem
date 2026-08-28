import { releaseAllotmentBlocksPastCutoff } from "@/lib/services/allotment-block-release.service";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { listCronOrganizationIdsFromDb, fetchHotelPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";

/** Cutoff soft-release. SHARED: ERA_CRON_ORGANIZATION_IDS override or DB User DISTINCT. */
export async function POST(req: Request) {
  try {
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_hotel_pms",
        moduleKey: "hotel_distribution",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "HOTEL_CRON_SECRET",
        listOrganizationIds: listCronOrganizationIdsFromDb,
        fetchPoolOrganizationIds: fetchHotelPoolOrganizationIds,
      },
      async (organizationId) => {
        const result = await releaseAllotmentBlocksPastCutoff(new Date());
        return { organizationId, ...result };
      },
    );
    if (!gate.ok) {
      if (gate.status === 401) return new Response("Unauthorized", { status: 401 });
      if (gate.status === 503) {
        return Response.json({ error: "satellite_unbound" }, { status: 503 });
      }
      return jsonOk({ skipped: true, reason: gate.reason, moduleKey: gate.moduleKey });
    }
    return jsonOk({ byOrganization: gate.results });
  } catch (err) {
    return handleRouteError(err);
  }
}
