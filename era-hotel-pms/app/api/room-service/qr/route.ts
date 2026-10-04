import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId") ?? "demo-room";
    const tableCode = url.searchParams.get("tableCode") ?? `RS-${roomId}`;
    return NextResponse.json({
      roomId,
      tableCode,
      fbPosTicketUrl: `/api/tickets/room-service?tableCode=${encodeURIComponent(tableCode)}`,
      qrPayload: `era-fb://room-service/${tableCode}`,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
