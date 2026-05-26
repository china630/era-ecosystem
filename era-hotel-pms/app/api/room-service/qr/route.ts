import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get("roomId") ?? "demo-room";
  const tableCode = url.searchParams.get("tableCode") ?? `RS-${roomId}`;
  return NextResponse.json({
    roomId,
    tableCode,
    fbPosTicketUrl: `/api/tickets/room-service?tableCode=${encodeURIComponent(tableCode)}`,
    qrPayload: `era-fb://room-service/${tableCode}`,
  });
}
