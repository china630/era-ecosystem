import { NextResponse } from "next/server";
import { runCronForEachTenant } from "@era/satellite-kit";
import { listCronOrganizationIdsFromDb, fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";

/** Service-token cron stub. SHARED: ERA_CRON_ORGANIZATION_IDS or DB User DISTINCT. */
export async function POST(req: Request) {
  const gate = await runCronForEachTenant(
    {
      satelliteKey: "industry_clinic",
      moduleKey: "clinic_service_catalog",
      authorization: req.headers.get("authorization"),
      cronSecretEnv: "PLATFORM_CRON_SECRET",
      listOrganizationIds: listCronOrganizationIdsFromDb,
        fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
    },
    async (organizationId) => {
      const base = process.env.ERA_CLINIC_URL ?? "http://127.0.0.1:3203";
      const res = await fetch(`${base.replace(/\/$/, "")}/api/catalog/sync`, {
        method: "POST",
        headers: { cookie: req.headers.get("cookie") ?? "" },
      });
      return {
        organizationId,
        status: res.status,
        data: await res.json(),
      };
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
  return NextResponse.json({ byOrganization: gate.results });
}
