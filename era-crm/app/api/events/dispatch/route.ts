import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isSatelliteEvent } from "@era/contracts";
import {
  assertEnvServiceToken,
  organizationIdOnIncomingRequest,
  publishToOrchestratorGateway,
} from "@era/satellite-kit";

/** SEC-SAT-01: require service token; never trust client organizationId or the process bind. */
export async function POST(req: Request) {
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

  const organizationId = organizationIdOnIncomingRequest(req);
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "organizationId is not bound on this request" },
      { status: 400 },
    );
  }

  const body = (await req.json()) as Record<string, unknown>;
  const event = {
    ...body,
    organizationId,
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
