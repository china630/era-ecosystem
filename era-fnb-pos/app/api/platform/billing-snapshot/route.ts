import { NextResponse } from "next/server";
import { resolveSatelliteOrganizationId } from "@era/satellite-kit";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";

export async function GET() {
  const { organizationId, source } = resolveSatelliteOrganizationId({ allowFallback: true });
  if (source === "fallback") {
    return NextResponse.json({
      skipped: true,
      reason: "satellite organizationId not bound",
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
