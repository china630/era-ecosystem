import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isSatelliteEvent } from "@era/contracts";
import {
  assertEnvServiceToken,
  publishToOrchestratorGateway,
} from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";

/** SEC-SAT-01: require service token; never trust client organizationId. */
export async function POST(req: Request) {
  await assertFnbEntitled();
  const authz = assertEnvServiceToken({
    expectedEnvKeys: ["SATELLITE_EVENT_SERVICE_TOKEN"],
    authorization: req.headers.get("authorization"),
    xServiceToken: req.headers.get("x-service-token"),
    // Always require token — route is on public API prefix (SEC-SAT-01)
    allowOpenInNonProduction: false,
  });
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const event = {
    ...body,
    organizationId: requestOrganizationId(),
    correlationId:
      typeof body.correlationId === "string" ? body.correlationId : randomUUID(),
    occurredAt:
      typeof body.occurredAt === "string"
        ? body.occurredAt
        : new Date().toISOString(),
  };
  if (!isSatelliteEvent(event)) {
    return NextResponse.json(
      { ok: false, error: "Unknown or invalid satellite event type" },
      { status: 400 },
    );
  }
  const result = await publishToOrchestratorGateway(event as Record<string, unknown>);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, event });
}
