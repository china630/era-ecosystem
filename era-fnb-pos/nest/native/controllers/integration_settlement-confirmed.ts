/** Lifted from nest/generated/integration_settlement-confirmed.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { SATELLITE_FB_SALE_COMPLETED } from "@era/contracts";
import { releaseTableForTicket } from "@/lib/ticket-helpers";
import { assertFbRevenueChannel } from "@/lib/fb-finance-events";
import { enterRequestTenant } from "@/lib/request-organization";
import { closeTicketOnHubSettlement, findTicketForHubSettlement, updateTicketSettlementPendingId } from "@/lib/ticket-pay.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  pendingId: z.string().min(1),
  sourceRef: z.string().min(1),
  paymentMethod: z.string().optional(),
  fiscalReceiptId: z.string().nullable().optional(),
  /** Hub always sends sourceOrgId — required for SHARED tenant enter before data access. */
  organizationId: z.string().min(1),
});

function verifyBridge(request: { headers: { get(name: string): string | null } }): boolean {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-pos-bridge-secret");
  const auth = request.headers.get("authorization");
  if (header === secret) return true;
  if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return true;
  return false;
}


@Controller()
export class IntegrationSettlementConfirmedController {
  @Post("api/integration/settlement-confirmed")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  
    if (!verifyBridge({ headers: { get: (name: string) => nestHeader(httpReq, name) } })) {
      return sendJson(httpRes, { error: "Unauthorized" }, 401);
    }

    const body = bodySchema.parse(httpReq.body);
    enterRequestTenant(body.organizationId);

    const ticket = await findTicketForHubSettlement(body.sourceRef);
    if (!ticket) {
      return sendJson(httpRes, { error: "Ticket not found" }, 404);
    }

    if (ticket.status === "CLOSED") {
      return sendJson(httpRes, { ok: true, alreadyClosed: true });
    }

    const storedPendingIds = ticket.settlementPendingId?.trim() ?? "";
    if (storedPendingIds.startsWith("[")) {
      const parsed = JSON.parse(storedPendingIds) as unknown;
      const ids = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
      const left = ids.filter((id) => id !== body.pendingId);
      if (left.length > 0) {
        await updateTicketSettlementPendingId(ticket.id, JSON.stringify(left));
        return sendJson(httpRes, { ok: true, waiting: left.length });
      }
    }

    // Fail-closed before CLOSE — hub settle completes money path (sale emit stays local-cashier only).
    await assertFbRevenueChannel(SATELLITE_FB_SALE_COMPLETED);

    const closedAt = new Date();
    await closeTicketOnHubSettlement({
      ticketId: ticket.id,
      closedAt,
      outletId: ticket.outletId,
      pendingId: body.pendingId,
      fiscalReceiptId: body.fiscalReceiptId ?? null,
    });
    await releaseTableForTicket(ticket.id, ticket.tableId);

    return sendJson(httpRes, { ok: true, ticketId: ticket.id, status: "CLOSED" });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
