import { assertFnbEntitled, handleRouteError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessAnyPermission, denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { HOTEL_READ_RESERVATIONS } from "@/lib/auth/read-permission-sets";

export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, HOTEL_READ_RESERVATIONS);
    if (denied) return denied;
    await assertHotelFnbFeature("reservations");
    const date = new URL(request.url).searchParams.get("date");
    const dayStart = date ? new Date(`${date}T00:00:00`) : new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const rows = await prisma.tableReservation.findMany({
      where: { startAt: { gte: dayStart, lt: dayEnd } },
      include: { table: { select: { code: true } } },
      orderBy: { startAt: "asc" },
    });
    return NextResponse.json(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  tableId: z.string(),
  startAt: z.string().datetime({ offset: true }).or(z.string()),
  endAt: z.string(),
  guestName: z.string().optional(),
  partySize: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(
      session,
      PERMISSIONS.RESERVATIONS_OPEN_TICKET,
    );
    if (denied) return denied;
    await assertHotelFnbFeature("reservations");
    const body = createSchema.parse(await request.json());
    const row = await prisma.tableReservation.create({
      data: {
        tableId: body.tableId,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        guestName: body.guestName,
        partySize: body.partySize ?? 2,
      },
      include: { table: { select: { code: true } } },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
