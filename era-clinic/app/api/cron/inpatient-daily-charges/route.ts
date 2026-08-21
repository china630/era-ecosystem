import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { postDailyWardCharges } from "@/domain/inpatient/daily-charge.service";
import { runCronForEachTenant } from "@era/satellite-kit";

export async function POST(req: Request) {
  try {
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_clinic",
        moduleKey: "clinic_inpatient",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
      },
      async () => {
        const url = new URL(req.url);
        const dateParam = url.searchParams.get("date");
        const chargeDate = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
        return postDailyWardCharges(chargeDate);
      },
    );
    if (!gate.ok) {
      if (gate.status === 401) return new Response("Unauthorized", { status: 401 });
      if (gate.status === 503) {
        return Response.json({ error: "satellite_unbound" }, { status: 503 });
      }
      return jsonOk({ skipped: true, reason: gate.reason, moduleKey: gate.moduleKey });
    }
    return jsonOk(gate.results[0]);
  } catch (err) {
    return handleRouteError(err);
  }
}
