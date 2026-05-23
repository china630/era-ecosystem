import { NextResponse } from "next/server";
import { publishToOrchestratorGateway, satelliteOrganizationId } from "@era/satellite-kit";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const body = (await req.json()) as { type: string; payload?: Record<string, unknown> };
  const event = {
    type: body.type,
    organizationId: satelliteOrganizationId(),
    correlationId: randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: body.payload ?? {},
  };
  const result = await publishToOrchestratorGateway(event);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, event });
}
