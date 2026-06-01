import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
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
}

const createSchema = z.object({
  tableId: z.string(),
  startAt: z.string().datetime({ offset: true }).or(z.string()),
  endAt: z.string(),
  guestName: z.string().optional(),
  partySize: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
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
}
