import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { runCronForEachTenant } from "@era/satellite-kit";
import { reconcileClinicStayOrganization } from "@/lib/stay-reconcile";

/**
 * 06:00 and 18:00 Asia/Baku, and on demand.
 * Opens a missing in-house course, closes a checked-out or departed guest,
 * and copies package, room, name, sex, and birth date when the live event was lost.
 * The planned checkout date does not close a course.
 */
export async function POST(req: Request) {
  try {
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_clinic",
        moduleKey: "clinic_sanatorium",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
        fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
      },
      async (organizationId) => reconcileClinicStayOrganization(organizationId),
    );
    if (!gate.ok) {
      if (gate.status === 401) return new Response("Unauthorized", { status: 401 });
      if (gate.status === 503) return Response.json({ error: gate.reason }, { status: 503 });
      return jsonOk({ skipped: true, reason: gate.reason, moduleKey: gate.moduleKey });
    }
    return jsonOk({ byOrganization: gate.results });
  } catch (err) {
    return handleRouteError(err);
  }
}
