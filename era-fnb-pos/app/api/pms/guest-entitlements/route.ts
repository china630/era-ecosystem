import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { fetchGuestEntitlements } from "@/lib/pms-bridge-client";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function GET(request: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.WAITER, FB_ROLES.MANAGER]);
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
}
