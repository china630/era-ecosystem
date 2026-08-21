import { NextResponse } from "next/server";
import { runCronForEachTenant } from "@era/satellite-kit";

/** Service-token cron stub for catalog sync (delegates to admin sync). */
export async function POST(req: Request) {
  const gate = await runCronForEachTenant(
    {
      satelliteKey: "industry_clinic",
      moduleKey: "clinic_service_catalog",
      authorization: req.headers.get("authorization"),
      cronSecretEnv: "PLATFORM_CRON_SECRET",
    },
    async () => {
      const base = process.env.ERA_CLINIC_URL ?? "http://127.0.0.1:3203";
      const res = await fetch(`${base.replace(/\/$/, "")}/api/catalog/sync`, {
        method: "POST",
        headers: { cookie: req.headers.get("cookie") ?? "" },
      });
      return { status: res.status, data: await res.json() };
    },
  );
  if (!gate.ok) {
    if (gate.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (gate.status === 503) {
      return NextResponse.json({ error: "satellite_unbound" }, { status: 503 });
    }
    return NextResponse.json({
      skipped: true,
      reason: gate.reason,
      moduleKey: gate.moduleKey,
    });
  }
  const first = gate.results[0]!;
  return NextResponse.json(first.data, { status: first.status });
}
