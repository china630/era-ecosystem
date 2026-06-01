import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isSatelliteEvent } from "@era/contracts";
import { publishToOrchestratorGateway, satelliteOrganizationId } from "@era/satellite-kit";

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const event = {
    ...body,
    organizationId:
      typeof body.organizationId === "string"
        ? body.organizationId
        : satelliteOrganizationId(),
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
