import { releaseAllotmentBlocksPastCutoff } from "@/lib/services/allotment-block-release.service";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { runCronForEachTenant } from "@era/satellite-kit";

/** Cutoff soft-release. Auth: Bearer HOTEL_CRON_SECRET when set. */
export async function POST(req: Request) {
  try {
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_hotel_pms",
        moduleKey: "hotel_distribution",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "HOTEL_CRON_SECRET",
      },
      async () => releaseAllotmentBlocksPastCutoff(new Date()),
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
