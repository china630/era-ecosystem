import { NextResponse } from "next/server";
import { handleRouteError, assertRetailEntitled } from "@/lib/api-utils";
import { requestOrganizationId } from "@/lib/request-organization";

export async function GET(request: Request) {
  try {
    await assertRetailEntitled();
    const url = new URL(request.url);
    const outletCode = url.searchParams.get("outlet") ?? undefined;
    const registerRef = url.searchParams.get("register") ?? undefined;
    const kind = url.searchParams.get("kind") as
      | "FISCAL_KKM"
      | "BANK_POS"
      | undefined;
    const { listDevicesForSatellite, resolveDefaultDevicesForSatellite } =
      await import("@era/satellite-kit");
    const organizationId = requestOrganizationId();
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
