import { assertFnbEntitled, handleRouteError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { listActiveBanquets } from "@/lib/pms-bridge-client";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { HOTEL_READ_BANQUETS } from "@/lib/auth/read-permission-sets";

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, HOTEL_READ_BANQUETS);
    if (denied) return denied;
    await assertHotelFnbFeature("banquets");
    const events = await listActiveBanquets();
    return NextResponse.json(events);
  } catch (err) {
    return handleRouteError(err);
  }
}
