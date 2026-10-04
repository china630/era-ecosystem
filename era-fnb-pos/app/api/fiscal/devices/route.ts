import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
/** List fiscal KKM / bank POS devices for cashier pick (F3). */
export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(
      session,
      PERMISSIONS.TICKETS_PAY,
    );
    if (denied || !session) {
      return denied ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const devices = listDevicesForSatellite({
      organizationId,
      outletCode,
      registerRef,
      kind,
    });
    const defaults = resolveDefaultDevicesForSatellite({
      organizationId,
      outletCode,
      registerRef,
    });
    return NextResponse.json({ devices, defaults });
  } catch (err) {
    return handleRouteError(err);
  }
}
