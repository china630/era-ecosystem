import { assertFnbEntitled, handleRouteError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { fetchGuestEntitlements } from "@/lib/pms-bridge-client";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    await assertHotelFnbFeature("in-house");
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.PMS_ENTITLEMENTS);
    if (denied) return denied;

    const url = new URL(request.url);
    const reservationId = url.searchParams.get("reservationId")?.trim();
    const roomNumber = url.searchParams.get("roomNumber")?.trim();
    if (!reservationId && !roomNumber) {
      return NextResponse.json(
        { error: "reservationId or roomNumber required" },
        { status: 400 },
      );
    }

    const entitlements = await fetchGuestEntitlements({ reservationId, roomNumber });
    if (!entitlements) {
      return NextResponse.json({ found: false });
    }
    return NextResponse.json(entitlements);
  } catch (err) {
    return handleRouteError(err);
  }
}
