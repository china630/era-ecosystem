import { NextResponse } from "next/server";
import { handleStaffProvisionEvent } from "@/lib/staff-provision";

/** Orchestrator fan-out: finance STAFF_PROVISIONED / STAFF_DEACTIVATED. */
export async function POST(request: Request) {
  const secret = process.env.SATELLITE_BRIDGE_SECRET?.trim() ?? "";
  const header = request.headers.get("x-satellite-bridge-secret")?.trim() ?? "";
  if (secret && header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const event = await request.json();
    const result = await handleStaffProvisionEvent(event);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provision failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
