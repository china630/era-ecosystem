import { assertFnbEntitled, handleRouteError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { listInHouseGuests } from "@/lib/pms-bridge-client";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { HOTEL_READ_IN_HOUSE } from "@/lib/auth/read-permission-sets";

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, HOTEL_READ_IN_HOUSE);
    if (denied) return denied;
    await assertHotelFnbFeature("in-house");
    const query = new URL(request.url).searchParams.get("query") ?? undefined;
    const guests = await listInHouseGuests(query);
    return NextResponse.json(guests);
  } catch (err) {
    return handleRouteError(err);
  }
}
