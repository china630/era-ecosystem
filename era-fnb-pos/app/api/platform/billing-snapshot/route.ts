import { NextResponse } from "next/server";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";

export async function GET() {
  const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? "";
  if (!organizationId) {
    return NextResponse.json({
      skipped: true,
      reason: "ERA_SATELLITE_ORGANIZATION_ID not set",
    });
  }
  try {
    const snapshot = await getSubscriptionMe({ organizationId });
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "billing snapshot failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
