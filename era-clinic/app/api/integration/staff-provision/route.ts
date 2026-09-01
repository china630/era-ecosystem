import { NextResponse } from "next/server";
import { handleStaffProvisionEvent, SatelliteLoginTakenError, SatelliteTargetAmbiguousError } from "@/lib/staff-provision";
import { enterRequestTenant } from "@/lib/request-organization";

function bridgeSecret(): string {
  return (
    process.env.SATELLITE_BRIDGE_SECRET?.trim() ||
    process.env.CLINIC_BRIDGE_SECRET?.trim() ||
    ""
  );
}

/** Orchestrator fan-out: CP STAFF_PROVISIONED / STAFF_DEACTIVATED. */
export async function POST(request: Request) {
  // SEC-HOT-01: fail closed in production when bridge secret unset
  const secret = bridgeSecret();
  const header = request.headers.get("x-satellite-bridge-secret")?.trim() ?? "";
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const event = (await request.json()) as { organizationId?: string };
    const organizationId =
      typeof event.organizationId === "string" ? event.organizationId.trim() : "";
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    }
    enterRequestTenant(organizationId);
    const result = await handleStaffProvisionEvent(event);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provision failed";
    const prismaCode =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    const code =
      err instanceof SatelliteLoginTakenError || prismaCode === "P2002"
        ? "LOGIN_TAKEN"
        : err instanceof SatelliteTargetAmbiguousError
          ? "TARGET_AMBIGUOUS"
          : undefined;
    const status =
      code === "LOGIN_TAKEN" || code === "TARGET_AMBIGUOUS" ? 409 : 400;
    return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
  }
}
