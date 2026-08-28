import { NextResponse } from "next/server";
import {
  runCronForEachTenant,
  runWithSatelliteTenant,
  satelliteRuntimeConfig,
} from "@era/satellite-kit";
import { listCronOrganizationIdsFromDb, fetchClinicPoolOrganizationIds } from "@/lib/cron-organization-ids";
import {
  evaluateAndPublishCapacity,
  getCapacitySummary,
} from "@/lib/capacity.service";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function authorize(request: Request): boolean {
  const secret = request.headers.get("x-clinic-bridge-secret");
  const expected = process.env.CLINIC_BRIDGE_SECRET;
  return Boolean(expected && secret === expected);
}

/**
 * Read capacity summary (bridge S2S).
 * Tenant: requires `x-era-organization-id` (no silent process bind on SHARED).
 */
export async function GET(request: Request) {
  if (!authorize(request)) return unauthorized();
  const url = new URL(request.url);
  const ref = url.searchParams.get("date");
  const refDate = ref ? new Date(ref) : new Date();
  const organizationId = request.headers.get("x-era-organization-id")?.trim();
  if (!organizationId) {
    return NextResponse.json(
      { error: "x-era-organization-id required" },
      { status: 400 },
    );
  }
  if (
    satelliteRuntimeConfig().deploymentTopology === "SHARED" &&
    !organizationId
  ) {
    return NextResponse.json(
      { error: "x-era-organization-id required on SHARED pool" },
      { status: 400 },
    );
  }
  return runWithSatelliteTenant({ organizationId }, async () => {
    const summary = await getCapacitySummary(refDate);
    return NextResponse.json(summary);
  });
}

/**
 * Evaluate + publish bus event when risk level changes (cron / hotel sync).
 * Multi-org: ERA_CRON_ORGANIZATION_IDS. Auth: Bearer CLINIC_BRIDGE_SECRET or legacy x-clinic-bridge-secret.
 */
export async function POST(request: Request) {
  const legacy = request.headers.get("x-clinic-bridge-secret");
  const authorization =
    request.headers.get("authorization") ??
    (legacy ? `Bearer ${legacy}` : null);

  const url = new URL(request.url);
  const ref = url.searchParams.get("date");
  const refDate = ref ? new Date(ref) : new Date();

  const gate = await runCronForEachTenant(
    {
      satelliteKey: "industry_clinic",
      moduleKey: "clinic_appointments",
      authorization,
      cronSecretEnv: "CLINIC_BRIDGE_SECRET",
      listOrganizationIds: listCronOrganizationIdsFromDb,
        fetchPoolOrganizationIds: fetchClinicPoolOrganizationIds,
    },
    async (organizationId) => {
      const result = await evaluateAndPublishCapacity(refDate);
      return { organizationId, ...result };
    },
  );

  if (!gate.ok) {
    if (gate.status === 401) return unauthorized();
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
