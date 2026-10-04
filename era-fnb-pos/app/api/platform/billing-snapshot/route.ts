import { NextResponse } from "next/server";
import { getSubscriptionMe } from "@/integration/control-plane-platform.client";
import { getSatelliteSession } from "@/lib/session";
import { handleRouteError } from "@/lib/api-utils";

export async function GET() {
  try {
    const organizationId = (await getSatelliteSession())?.organizationId;
    if (!organizationId) {
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
  } catch (err) {
    return handleRouteError(err);
  }
}
