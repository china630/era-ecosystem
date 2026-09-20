import { NextResponse } from "next/server";
import { assertFnbEntitled, handleRouteError } from "@/lib/api-utils";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";

/** List fiscal KKM / bank POS devices for cashier pick (F3). */
export async function GET(request: Request) {
  await assertFnbEntitled();
  try {
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(
      session,
      PERMISSIONS.TICKETS_PAY,
    );
    if (denied && denied.status === 401) return denied;

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
