import { NextResponse } from "next/server";
import { z } from "zod";
import { runPlatformCommerceHooks } from "@era/satellite-kit";
import { postRoomCharge, fetchGuestEntitlements } from "@/lib/pms-bridge-client";
import { roomChargeBlockedReason, resolveTicketSettlement } from "@/lib/billing-router";
import { closeTicketRoomCharge, getTicketForRoomCharge } from "@/lib/ticket.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { daySeqMap, isUuid, releaseTableForTicket } from "@/lib/ticket-helpers";
import { shiftIdCovering } from "@/lib/open-shift";
import { sessionActorName } from "@/lib/session";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { resolveHotelRevenueCode } from "@era/satellite-kit/integration/hotel-revenue-route";
import { discountedLineAmounts } from "@/lib/ticket-line-amounts";
import { recordFbAudit } from "@/lib/satellite-audit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z
  .object({
    roomNumber: z.string().optional(),
    reservationId: z.string().uuid().optional(),
  })
  .optional();

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/tickets/:id/room-charge", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    await assertHotelFnbFeature("room-charge");
    const denied = denyUnlessPermission(session, PERMISSIONS.ROOM_CHARGE);
    if (denied) return denied;
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body.catch(() => undefined));

    const ticket = await getTicketForRoomCharge(id);
    if (!ticket) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }

    const linked = ticket.roomChargeReservationId;
    const reservationId =
      body?.reservationId ??
      (linked && isUuid(linked) ? linked : undefined);
    const roomNumber =
      body?.roomNumber ??
      (linked && !isUuid(linked) ? linked : undefined);

    if (!reservationId && !roomNumber) {
      return sendJson(httpRes, 
        { error: "No room charge guest linked (reservationId or roomNumber)" }, 400);
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
      return sendJson(httpRes, { error: roomBlock }, 400);
    }

    const settlement = await resolveTicketSettlement(ticketForBilling);
    if (settlement !== "HOTEL_FOLIO") {
      return sendJson(httpRes, 
        { error: "Room charge only for in-house hotel guests" }, 400);
    }

    const amount = Number(ticket.totalAzn);

    if (amount <= 0) {
      const entitlements = await fetchGuestEntitlements({ reservationId, roomNumber });
      if (!entitlements?.found || !entitlements.breakfastIncluded) {
        return sendJson(httpRes, 
          {
            error: "Meal not included on rate plan — charge guest or use CASH/CARD",
            denyReason: "MEAL_NOT_INCLUDED",
          }, 403);
      }
    }

    if (ticket.lines.length === 0) {
      return sendJson(httpRes, { error: "Finance SKU is required" }, 400);
    }
    for (const line of ticket.lines) {
      const productSku = line.menuItem?.financeSku?.trim();
      if (!productSku) {
        return sendJson(httpRes, 
          { error: `Finance SKU is required for ${line.description}` }, 400);
      }
    }

    const amounts = discountedLineAmounts(
      ticket.lines.map((line) => ({
        id: line.id,
        qty: Number(line.qty),
        unitPriceAzn: Number(line.unitPriceAzn),
      })),
      Number(ticket.totalAzn),
    );
    let result: { ok: boolean; status: number; body: unknown } | null = null;
    for (const line of ticket.lines) {
      const productSku = line.menuItem?.financeSku?.trim() ?? "";
      let revenueCode = "";
      try {
        revenueCode = resolveHotelRevenueCode({
          category: line.menuItem?.category?.revenueCode,
          satellite: ticket.outlet.revenueCenterCode,
        });
      } catch {
        return sendJson(httpRes, 
          { error: `Revenue code is required for ${line.description}` }, 400);
      }
      const lineAmount = amounts.get(line.id) ?? 0;
      const { fnbTicketLineRef } = await import("@era/satellite-kit/integration/folio-charge-ref");
      const lineKey = fnbTicketLineRef(ticket.id, line.id);
      result = await postRoomCharge(
        {
          reservationId,
          roomNumber,
          revenueCode,
          amount: lineAmount,
          qty: line.qty,
          productSku,
          warehouseCode: ticket.outlet.financeWarehouseCode ?? undefined,
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
      return sendJson(httpRes, 
        { ...failed, denyReason: denyReason ?? failed?.error }, (
        { status: result?.status ?? 502 }).status ?? 200);
    }

    const closedAt = new Date();
    await closeTicketRoomCharge(id, {
      closedAt,
      roomNumberLabel: roomNumber ?? ticket.roomNumberLabel,
      shiftId: await shiftIdCovering(ticket.outletId, closedAt),
      closedByName: sessionActorName(session),
    });
    await releaseTableForTicket(id, ticket.tableId);

    await recordFbAudit(
      { userId: session?.sub, request },
      "Ticket",
      id,
      "ROOM_CHARGE",
      {
        amount,
        reservationId: reservationId ?? null,
        roomNumber: roomNumber ?? null,
        outletId: ticket.outletId,
      },
    );

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

    const posted = result.body;
    const gross = ticket.lines.reduce((sum, line) => sum + line.qty * Number(line.unitPriceAzn), 0);
    const slip = {
      copies: 2,
      kind: "ROOM",
      ticketId: id,
      dayNo: (await daySeqMap(ticket.organizationId)).get(id) ?? null,
      outletName: ticket.outlet.name,
      table: ticket.table?.name ?? ticket.table?.code ?? null,
      guestName: ticket.guestName,
      room: roomNumber ?? ticket.roomNumberLabel,
      waiter: ticket.waiterLabel,
      at: closedAt.toISOString(),
      total: amount,
      discountAzn: Math.max(0, Math.round((gross - amount) * 100) / 100),
      limitBalanceAfter: null,
      holderName: null,
      lines: ticket.lines.map((line) => ({
        name: line.description,
        qty: line.qty,
        amount: Math.round(line.qty * Number(line.unitPriceAzn) * 100) / 100,
      })),
    };
    return sendJson(httpRes, 
      posted && typeof posted === "object"
        ? { ...posted, slip }
        : { slip },
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
