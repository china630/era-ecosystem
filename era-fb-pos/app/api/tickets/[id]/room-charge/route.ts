import { NextResponse } from "next/server";
import { postRoomCharge } from "@/lib/pms-bridge-client";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { outlet: true, table: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!ticket.roomChargeReservationId) {
    return NextResponse.json(
      { error: "No room charge reservation linked" },
      { status: 400 },
    );
  }

  const amount = Number(ticket.totalAzn);
  const result = await postRoomCharge(
    {
      roomNumber: ticket.roomChargeReservationId,
      revenueCode: ticket.outlet.revenueCenterCode,
      amount,
      description: `FB ticket ${ticket.id.slice(0, 8)}`,
      outletCode: ticket.outlet.code,
      externalTicketId: ticket.id,
    },
    ticket.id,
  );

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  await prisma.ticket.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  return NextResponse.json(result.body);
}
