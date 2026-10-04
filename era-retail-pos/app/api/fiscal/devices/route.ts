import { NextResponse } from "next/server";
import { handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const url = new URL(request.url);
    const outletCode = url.searchParams.get("outlet") ?? undefined;
    const registerRef = url.searchParams.get("register") ?? undefined;
    const kind = url.searchParams.get("kind") as
      | "FISCAL_KKM"
      | "BANK_POS"
      | undefined;
    const { listDevicesForSatellite, resolveDefaultDevicesForSatellite } =
      await import("@era/satellite-kit");
    const organizationId = session.organizationId;
    return NextResponse.json({
      devices: listDevicesForSatellite({
        organizationId,
        outletCode,
        registerRef,
        kind,
      }),
      defaults: resolveDefaultDevicesForSatellite({
        organizationId,
        outletCode,
        registerRef,
      }),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
