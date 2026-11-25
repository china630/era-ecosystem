/** Lifted from nest/generated/tickets_room-service.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { ensureOutletByCode } from "@/lib/outlet-helpers";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";
import { sessionActorName } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { createRoomServiceTicket } from "@/lib/ticket.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  roomNumber: z.string().min(1),
  guestName: z.string().optional(),
  outletCode: z.string().min(1),
  lines: z
    .array(
      z.object({
        description: z.string(),
        qty: z.number().int().positive().default(1),
        unitPriceAzn: z.number().nonnegative(),
      }),
    )
    .min(1),
});

/** Room service ticket — no table; routes to KDS via standard fire flow. */


@Controller()
export class TicketsRoomServiceController {
  @Post("api/tickets/room-service")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    await assertHotelFnbFeature("room-service");
    const denied = denyUnlessPermission(session, PERMISSIONS.ROOM_SERVICE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const body = schema.parse(httpReq.body);
    const outlet = await ensureOutletByCode(body.outletCode);
    const cookieOutlet = await getSelectedOutletId();
    const outletId = cookieOutlet && cookieOutlet === outlet.id ? outlet.id : outlet.id;

    const subtotal = body.lines.reduce((s, l) => s + l.qty * l.unitPriceAzn, 0);
    const ticket = await createRoomServiceTicket(
      requestOrganizationId(),
      outletId,
      body.guestName ?? `Room ${body.roomNumber}`,
      sessionActorName(session),
      body.lines,
      subtotal,
    );

    return sendJson(httpRes, ticket, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
