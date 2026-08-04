import { NextResponse } from "next/server";
import { handleStaffProvisionEvent } from "@/lib/staff-provision";

/** Orchestrator fan-out: finance STAFF_PROVISIONED / STAFF_DEACTIVATED. */
export async function POST(request: Request) {
  // SEC-HOT-01: fail closed in production when bridge secret unset
  const secret = process.env.SATELLITE_BRIDGE_SECRET?.trim() ?? "";
  const header = request.headers.get("x-satellite-bridge-secret")?.trim() ?? "";
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (header !== secret) {
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
