import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { postDailyWardCharges } from "@/domain/inpatient/daily-charge.service";
import { listCronOrganizationIdsFromDb, fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";
import { bakuCivilUtcDate } from "@/lib/baku-day";

export async function POST(req: Request) {
  try {
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_clinic",
        moduleKey: "clinic_inpatient",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
        listOrganizationIds: listCronOrganizationIdsFromDb,
        fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
      },
      async (organizationId) => {
        const url = new URL(req.url);
        const dateParam = url.searchParams.get("date");
        const chargeDate = dateParam ? bakuCivilUtcDate(dateParam) : new Date();
        const result = await postDailyWardCharges(chargeDate);
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
