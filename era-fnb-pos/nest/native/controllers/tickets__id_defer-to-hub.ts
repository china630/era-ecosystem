/** Lifted from nest/generated/tickets__id_defer-to-hub.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { releaseTableForTicket } from "@/lib/ticket-helpers";
import { getTicketForDeferToHub, markTicketPendingHub } from "@/lib/ticket.service";
import { payBlockedReason, resolveTicketSettlement } from "@/lib/billing-router";
import { postHotelSettlementPending } from "@/lib/settlement-hub-client";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { resolveHotelRevenueCode } from "@era/satellite-kit/integration/hotel-revenue-route";
import { discountedLineAmounts } from "@/lib/ticket-line-amounts";
import { recordFbAudit } from "@/lib/satellite-audit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class TicketsIdDeferToHubController {
  @Post("api/tickets/:id/defer-to-hub")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    await assertHotelFnbFeature("defer-to-hub");
    const denied = denyUnlessPermission(session, PERMISSIONS.DEFER_HUB);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id } = httpReq.params;
    const ticket = await getTicketForDeferToHub(id);
    if (!ticket) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }
    if (!["OPEN", "HELD"].includes(ticket.status)) {
      return sendJson(httpRes, { error: "Ticket is not open" }, 400);
    }

    const settlement = await resolveTicketSettlement(ticket);
    if (settlement !== "HOTEL_HUB") {
      const reason = payBlockedReason(settlement) ?? "Not eligible for reception defer";
      return sendJson(httpRes, { error: reason }, 400);
    }

    const amount = Number(ticket.totalAzn);
    if (amount <= 0) {
      return sendJson(httpRes, { error: "Ticket total must be positive" }, 400);
    }

    if (ticket.lines.length === 0) {
      return sendJson(httpRes, { error: "Finance SKU is required" }, 400);
    }
    for (const line of ticket.lines) {
      if (!line.menuItem?.financeSku?.trim()) {
        return sendJson(httpRes, 
          { error: `Finance SKU is required for ${line.description}` }, 400);
      }
    }

    const payerLabel =
      ticket.walkInLabel?.trim() ||
      ticket.guestName?.trim() ||
      ticket.table?.code ||
      "Walk-in";

    const amounts = discountedLineAmounts(
      ticket.lines.map((line) => ({
        id: line.id,
        qty: Number(line.qty),
        unitPriceAzn: Number(line.unitPriceAzn),
      })),
      amount,
    );
    const pendingIds: string[] = [];
    for (const line of ticket.lines) {
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
      const pending = await postHotelSettlementPending({
        sourceSystem: "FNB_POS",
        sourceRef: ticket.id,
        amount: amounts.get(line.id) ?? 0,
        description: `${line.qty}x ${line.description}`,
        payerLabel,
        idempotencyKey: `ticket-${ticket.id}-${line.id}`,
        sku: line.menuItem?.financeSku?.trim(),
        qty: line.qty,
        revenueCode,
      });
      const pendingId = pending.id as string;
      if (pendingId) pendingIds.push(pendingId);
    }
    const pendingId = pendingIds[0] ?? "";
    await markTicketPendingHub(id, JSON.stringify(pendingIds));
    await releaseTableForTicket(id, ticket.tableId);

    await recordFbAudit(
      { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      "Ticket",
      id,
      "DEFER_HUB",
      {
        amount,
        pendingId,
        pendingCount: pendingIds.length,
        settlement: "HOTEL_HUB",
        outletId: ticket.outletId,
      },
    );

    return sendJson(httpRes, { ok: true, pendingId, settlement: "HOTEL_HUB" });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
