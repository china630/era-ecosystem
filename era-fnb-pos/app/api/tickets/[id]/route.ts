import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  roomChargeReservationId: z.string().nullable().optional(),
  roomNumber: z.string().optional(),
  guestName: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertFnbEntitled();
  const { id } = await params;
  const body = patchSchema.parse(await request.json());

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      roomChargeReservationId:
        body.roomChargeReservationId !== undefined
          ? body.roomChargeReservationId || null
          : body.roomNumber !== undefined
            ? body.roomNumber || null
            : ticket.roomChargeReservationId,
      guestName:
        body.guestName !== undefined ? body.guestName || null : ticket.guestName,
    },
    include: { lines: true, table: true, outlet: true },
  });

  return NextResponse.json(updated);
}
