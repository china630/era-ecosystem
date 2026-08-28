import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runPlatformCommerceHooks } from "@era/satellite-kit";
import { postRoomCharge, fetchGuestEntitlements } from "@/lib/pms-bridge-client";
import { prisma } from "@/lib/prisma";
import {
  roomChargeBlockedReason,
  resolveTicketSettlement,
} from "@/lib/billing-router";
import { requestOrganizationId } from "@/lib/request-organization";
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
  await assertFnbEntitled();
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

  const ticketForBilling = {
    ...ticket,
    roomChargeReservationId:
      ticket.roomChargeReservationId ??
      reservationId ??
      roomNumber ??
      null,
  };
  const roomBlock = roomChargeBlockedReason(ticketForBilling);
  if (roomBlock) {
    return NextResponse.json({ error: roomBlock }, { status: 400 });
  }

  const settlement = await resolveTicketSettlement(ticketForBilling);
  if (settlement !== "HOTEL_FOLIO") {
    return NextResponse.json(
      { error: "Room charge only for in-house hotel guests" },
      { status: 400 },
    );
  }

  const amount = Number(ticket.totalAzn);

  if (amount <= 0) {
    const entitlements = await fetchGuestEntitlements({ reservationId, roomNumber });
    if (!entitlements?.found || !entitlements.breakfastIncluded) {
      return NextResponse.json(
        {
          error: "Meal not included on rate plan — charge guest or use CASH/CARD",
          denyReason: "MEAL_NOT_INCLUDED",
        },
        { status: 403 },
      );
    }
  }

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
    const body = result.body as { error?: string; code?: string };
    const denyReason =
      body?.error === 'CREDIT_LIMIT' || String(body?.error ?? '').includes('CREDIT_LIMIT')
        ? 'CREDIT_LIMIT'
        : body?.error;
    return NextResponse.json(
      { ...body, denyReason: denyReason ?? body?.error },
      { status: result.status },
    );
  }

  await prisma.ticket.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await releaseTableForTicket(id, ticket.tableId);

  const organizationId = requestOrganizationId();
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
