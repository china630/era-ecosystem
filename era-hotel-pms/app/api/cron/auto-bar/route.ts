import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { addHotelDays } from "@/lib/hotel-calendar";
import { applyAutoBar } from "@/lib/services/auto-bar-engine.service";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { listCronOrganizationIdsFromDb, fetchHotelPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";

/** Nightly auto-BAR. SHARED: ERA_CRON_ORGANIZATION_IDS override or DB User DISTINCT. */
export async function POST(req: Request) {
  try {
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_hotel_pms",
        moduleKey: "hotel_setup_advanced",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "HOTEL_CRON_SECRET",
        listOrganizationIds: listCronOrganizationIdsFromDb,
        fetchPoolOrganizationIds: fetchHotelPoolOrganizationIds,
      },
      async (organizationId) => {
        const fromKey = todayBakuYmd();
        const from = bakuCivilUtcDate(fromKey);
        const to = bakuCivilUtcDate(addHotelDays(fromKey, 90));
        const result = await applyAutoBar({ from, to });
        return {
          organizationId,
          ...result,
          from: fromKey,
          to: addHotelDays(fromKey, 90),
        };
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
