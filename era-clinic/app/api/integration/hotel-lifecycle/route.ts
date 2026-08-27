import { NextResponse } from "next/server";
import {
  isSatelliteHotelGuestCheckedIn,
  isSatelliteHotelGuestCheckedOut,
  isSatelliteHotelRoomChanged,
  isSatelliteHotelSanatoriumBookingCreated,
  isSatelliteHotelStayProductChanged,
  getSatelliteEventType,
} from "@era/contracts";
import {
  handleGuestCheckedIn,
  handleGuestCheckedOut,
  handleRoomChanged,
  handleSanatoriumBookingCreated,
  handleStayProductChanged,
} from "@/lib/lifecycle-consumer";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const secret = request.headers.get("x-clinic-bridge-secret");
  const expected = process.env.CLINIC_BRIDGE_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const correlationId =
    body && typeof body === "object" && "correlationId" in body
      ? String((body as { correlationId: unknown }).correlationId)
      : null;
  const eventType = getSatelliteEventType(body) ?? "unknown";

  if (correlationId) {
    try {
      await prisma.processedEvent.create({
        data: { correlationId, eventType },
      });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: string }).code
          : "";
      if (code === "P2002") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      throw err;
    }
  }

  try {
    if (isSatelliteHotelSanatoriumBookingCreated(body)) {
      const episode = await handleSanatoriumBookingCreated(body);
      return NextResponse.json({ ok: true, episodeId: episode.id, planned: true });
    }
    if (isSatelliteHotelGuestCheckedIn(body)) {
      const episode = await handleGuestCheckedIn(body);
      return NextResponse.json({ ok: true, episodeId: episode.id });
    }
    if (isSatelliteHotelGuestCheckedOut(body)) {
      await handleGuestCheckedOut(body);
      return NextResponse.json({ ok: true });
    }
    if (isSatelliteHotelRoomChanged(body)) {
      await handleRoomChanged(body);
      return NextResponse.json({ ok: true });
    }
    if (isSatelliteHotelStayProductChanged(body)) {
      await handleStayProductChanged(body);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown event type" }, { status: 400 });
  } catch (err) {
    if (correlationId) {
      await prisma.processedEvent
        .delete({ where: { correlationId } as never })
        .catch(() => null);
    }
    const msg = err instanceof Error ? err.message : "handler failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
