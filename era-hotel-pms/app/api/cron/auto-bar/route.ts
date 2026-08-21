import { applyAutoBar } from "@/lib/services/auto-bar-engine.service";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { runCronForEachTenant } from "@era/satellite-kit";

/** Nightly auto-BAR job — respects MANUAL locks. */
export async function POST(req: Request) {
  try {
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_hotel_pms",
        moduleKey: "hotel_setup_advanced",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "HOTEL_CRON_SECRET",
      },
      async () => {
        const today = new Date();
        const from = new Date(today.toISOString().slice(0, 10));
        const to = new Date(from);
        to.setUTCDate(to.getUTCDate() + 90);
        const result = await applyAutoBar({ from, to });
        return {
          ...result,
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
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
    return jsonOk(gate.results[0]);
  } catch (err) {
    return handleRouteError(err);
  }
}
