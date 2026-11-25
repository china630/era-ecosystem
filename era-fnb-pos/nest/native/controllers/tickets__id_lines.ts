/** Lifted from nest/generated/tickets__id_lines.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertMenuItemNotSoldOut } from "@/lib/fnb-sold-out";
import { requireOpenShift } from "@/lib/open-shift";
import { addTicketLines, findMenuItemIdByPlu, findTicketById, listTicketLines } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const lineSchema = z.object({
  description: z.string().min(1),
  qty: z.number().int().positive().default(1),
  unitPriceAzn: z.number().nonnegative(),
  menuItemPlu: z.string().optional(),
  notes: z.string().optional(),
});

const createSchema = z.union([lineSchema, z.array(lineSchema)]);


@Controller()
export class TicketsIdLinesController {
  @Post("api/tickets/:id/lines")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_LINES);
  if (denied) return sendJson(httpRes, denied.body, denied.status);

  const { id } = httpReq.params;
  const ticket = await findTicketById(id);
  if (!ticket) {
    return sendJson(httpRes, { error: "Ticket not found" }, 404);
  }
  if (!["OPEN", "HELD"].includes(ticket.status)) {
    return sendJson(httpRes, 
      { error: "Ticket is not open for new lines" }, 400);
  }
  await requireOpenShift(ticket.outletId);

  const parsed = createSchema.parse(httpReq.body);
  const items = Array.isArray(parsed) ? parsed : [parsed];

  for (const item of items) {
    if (item.menuItemPlu) {
      const menuItemId = await findMenuItemIdByPlu(item.menuItemPlu);
      if (menuItemId) {
        await assertMenuItemNotSoldOut({
          outletId: ticket.outletId,
          menuItemId,
          plu: item.menuItemPlu,
        });
      }
    }
  }

  await addTicketLines(id, ticket.organizationId, items);

  const updated = await recalculateTicketTotals(id);
  const lines = await listTicketLines(id);

  return sendJson(httpRes, { ...updated, lines }, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
