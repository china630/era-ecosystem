import { NextResponse } from "next/server";
import { z } from "zod";
import { runPlatformCommerceHooks } from "@era/satellite-kit";
import { postRoomCharge } from "@/lib/pms-bridge-client";
import { prisma } from "@/lib/prisma";
import { isUuid, releaseTableForTicket } from "@/lib/ticket-helpers";

const bodySchema = z
  .object({
    roomNumber: z.string().optional(),
    reservationId: z.string().uuid().optional(),
  })
  .optional();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = bodySchema.parse(await request.json().catch(() => undefined));

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { outlet: true, table: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const linked = ticket.roomChargeReservationId;
  const reservationId =
    body?.reservationId ??
    (linked && isUuid(linked) ? linked : undefined);
  const roomNumber =
    body?.roomNumber ??
    (linked && !isUuid(linked) ? linked : undefined);

  if (!reservationId && !roomNumber) {
    return NextResponse.json(
      { error: "No room charge guest linked (reservationId or roomNumber)" },
      { status: 400 },
    );
  }

  const amount = Number(ticket.totalAzn);
  const result = await postRoomCharge(
    {
      reservationId,
      roomNumber,
      revenueCode: ticket.outlet.revenueCenterCode,
      amount,
      description: `FB ticket ${ticket.table?.code ?? "walk-in"} — ${ticket.id.slice(0, 8)}`,
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
  await releaseTableForTicket(id, ticket.tableId);

  const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? "";
  if (organizationId) {
    void runPlatformCommerceHooks({
      organizationId,
      portal: { entityType: "fb_ticket", entityId: ticket.id },
      payment: {
        amountAzn: amount,
        sourceEntityType: "fb_room_charge",
        sourceEntityId: ticket.id,
        description: `Room charge ${roomNumber ?? reservationId ?? ""}`,
      },
      ...(ticket.tableId
        ? {
            bookingSlot: {
              resourceKey: `fb-table-${ticket.tableId}`,
              resourceName: ticket.table?.name ?? `Table ${ticket.tableId}`,
              startsAt: new Date().toISOString(),
              endsAt: new Date(Date.now() + 7200_000).toISOString(),
              capacity: 1,
              metadata: { ticketId: ticket.id },
            },
          }
        : {}),
    }).catch(() => undefined);
  }

  return NextResponse.json(result.body);
}
