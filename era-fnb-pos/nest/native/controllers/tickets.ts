/** Lifted from nest/generated/tickets.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";
import { sessionActorName } from "@/lib/session";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_TICKETS } from "@/lib/auth/read-permission-sets";
import { assertTicketCreateQuota } from "@/lib/fnb-quota";
import { assertMenuItemNotSoldOut } from "@/lib/fnb-sold-out";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { attachDayNos } from "@/lib/ticket-helpers";
import { requireCurrentShift } from "@/lib/open-shift";
import { createTicketWithLines, listOpenHeldTickets, occupyTableForTicket } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  outletCode: z.string().min(1).optional(),
  tableId: z.string().optional(),
  beoId: z.string().optional(),
  serviceChannel: z.enum(["DINE_IN", "ROOM_SERVICE", "WALK_IN", "TAKEAWAY"]).optional(),
  walkInLabel: z.string().max(120).optional(),
  covers: z.number().int().positive().optional(),
  guestName: z.string().optional(),
  lines: z
    .array(
      z.object({
        description: z.string(),
        qty: z.number().int().positive().default(1),
        unitPriceAzn: z.number().nonnegative(),
        menuItemPlu: z.string().optional(),
      }),
    )
    .optional(),
});


@Controller()
export class TicketsController {
  @Get("api/tickets")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_TICKETS);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const beoId = url.searchParams.get("beoId");
    const serviceChannel = url.searchParams.get("serviceChannel");
    const outletIdParam = url.searchParams.get("outletId");
    const selectedOutlet = outletIdParam ?? (await getSelectedOutletId());

    const tickets = await listOpenHeldTickets({
      ...(beoId ? { beoId } : {}),
      ...(serviceChannel ? { serviceChannel } : {}),
      ...(selectedOutlet ? { outletId: selectedOutlet } : {}),
    });
    return sendJson(httpRes, await attachDayNos(tickets));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/tickets")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_OPEN);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const orgId = requestOrganizationId();
    assertTicketCreateQuota(orgId);

    const body = createSchema.parse(httpReq.body);
    if (body.beoId || body.serviceChannel === "ROOM_SERVICE") {
      await assertHotelFnbFeature("hotel-ticket");
    }
    const outlet = await resolveOpsOutlet(body.outletCode);
    const { outletAllowsTill } = await import("@/lib/outlet-capabilities");
    if (!outletAllowsTill(outlet)) {
      return sendJson(httpRes, { error: "Outlet has no till capability — cannot open ticket" }, 400);
    }
    await requireCurrentShift(outlet.id);

    const lines = body.lines ?? [];
    for (const l of lines) {
      if (l.menuItemPlu) {
        await assertMenuItemNotSoldOut({ outletId: outlet.id, plu: l.menuItemPlu });
      }
    }
  const subtotal = lines.reduce(
    (s, l) => s + l.qty * l.unitPriceAzn,
    0,
  );

  const channel =
    body.serviceChannel ??
    (body.walkInLabel ? "WALK_IN" : body.tableId ? "DINE_IN" : undefined);

  const ticket = await createTicketWithLines({
    organizationId: requestOrganizationId(),
    outletId: outlet.id,
    tableId: body.tableId,
    covers: body.covers ?? 1,
    guestName: body.guestName,
    serviceChannel: channel,
    walkInLabel: body.walkInLabel,
    beoId: body.beoId,
    openedByName: sessionActorName(session),
    waiterLabel: sessionActorName(session),
    subtotalAzn: subtotal,
    lines,
  });

  if (body.tableId && lines.length > 0) {
    await occupyTableForTicket(body.tableId, ticket.id);
  }

  const [withDay] = await attachDayNos([ticket]);
  return sendJson(httpRes, withDay ?? ticket, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
