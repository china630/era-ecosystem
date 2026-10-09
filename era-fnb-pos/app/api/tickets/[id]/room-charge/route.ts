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
import { shiftIdCovering } from "@/lib/open-shift";
import { getSatelliteSession, sessionActorName } from "@/lib/session";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { handleRouteError } from "@/lib/api-utils";

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
  try {
    await assertHotelFnbFeature("room-charge");
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.ROOM_CHARGE);
    if (denied) return denied;
    const { id } = await params;
    const body = bodySchema.parse(await request.json().catch(() => undefined));

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { outlet: true, table: true, lines: { include: { menuItem: true } } },
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

    if (ticket.lines.length === 0) {
      return NextResponse.json({ error: "Finance SKU is required" }, { status: 400 });
    }
    for (const line of ticket.lines) {
      const productSku = line.menuItem?.financeSku?.trim();
      if (!productSku) {
        return NextResponse.json(
          { error: `Finance SKU is required for ${line.description}` },
          { status: 400 },
        );
      }
    }

    let result: { ok: boolean; status: number; body: unknown } | null = null;
    for (const line of ticket.lines) {
      const productSku = line.menuItem?.financeSku?.trim() ?? "";
      const lineAmount = Number(line.qty) * Number(line.unitPriceAzn);
      const lineKey = `${ticket.id}:${line.id}`;
      result = await postRoomCharge(
        {
          reservationId,
          roomNumber,
          revenueCode: ticket.outlet.revenueCenterCode,
          amount: lineAmount,
          qty: line.qty,
          productSku,
          description: `${line.qty}x ${line.description}`,
          outletCode: ticket.outlet.code,
          externalTicketId: lineKey,
        },
        lineKey,
      );
      if (!result.ok) break;
    }

    if (!result?.ok) {
      const failed = result?.body as { error?: string; code?: string } | undefined;
      const denyReason =
        failed?.error === "CREDIT_LIMIT" || String(failed?.error ?? "").includes("CREDIT_LIMIT")
          ? "CREDIT_LIMIT"
          : failed?.error;
      return NextResponse.json(
        { ...failed, denyReason: denyReason ?? failed?.error },
        { status: result?.status ?? 502 },
      );
    }

    const closedAt = new Date();
    await prisma.ticket.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt,
        shiftId: await shiftIdCovering(ticket.outletId, closedAt),
        closedByName: sessionActorName(session),
      },
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
  } catch (err) {
    return handleRouteError(err);
  }
}
