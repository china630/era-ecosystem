/** Lifted from era-hotel-pms/nest/generated/housekeeping_laundry.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createLaundryTicket, deliverLaundryTicket, listLaundryWorkspace } from '@/lib/services/hk-nafta.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

function laundryReadWritePerms() {
  return [PERMISSIONS.HOUSEKEEPING_MANAGE, PERMISSIONS.FOLIO_CHARGE] as const;
}



const createTicket = z.object({
  roomId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  guestName: z.string().optional(),
  express: z.boolean().optional(),
  intakeNote: z.string().optional(),
  lines: z.array(
    z.object({
      itemId: z.string().uuid(),
      washQty: z.number().int().min(0),
      ironQty: z.number().int().min(0),
      guestQty: z.number().int().min(0).optional(),
      hotelQty: z.number().int().min(0).optional(),
    }),
  ),
});

const deliverBody = z.object({
  deliverTicketId: z.string().uuid(),
  returnScanKey: z.string().min(1),
  actorRole: z.enum(['HK', 'FO']).optional(),
});

const voidBody = z.object({
  voidTicketId: z.string().uuid(),
});


@Controller()
export class HousekeepingLaundryController {
  @Get("api/housekeeping/laundry")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [...laundryReadWritePerms()]);
    const reservationId = requestUrl.searchParams.get('reservationId');
    const board = await listLaundryWorkspace(reservationId);
    return sendJson(httpRes, serialize(board));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/housekeeping/laundry")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    const body = httpReq.body;
    if (body.voidTicketId) {
      assertAnyPermission(session, [...laundryReadWritePerms()]);
      const data = voidBody.parse(body);
      const { voidOpenLaundryTicket } = await import('@/lib/services/hk-nafta.service');
      return sendJson(httpRes, serialize(await voidOpenLaundryTicket(data.voidTicketId)));
    }
    if (body.deliverTicketId) {
      assertAnyPermission(session, [...laundryReadWritePerms()]);
      const data = deliverBody.parse(body);
      const { sessionHasHotelPermission } = await import('@/lib/auth/permission-check');
      const hk =
        session &&
        sessionHasHotelPermission(
          {
            login: session.login,
            email: session.email,
            role: session.role,
            permissions: session.permissions,
            isOwner: session.isOwner,
          },
          PERMISSIONS.HOUSEKEEPING_MANAGE,
        );
      const role: 'HK' | 'FO' = data.actorRole ?? (hk ? 'HK' : 'FO');
      return sendJson(httpRes, 
        serialize(
          await deliverLaundryTicket({
            ticketId: data.deliverTicketId,
            actorUserId: session!.sub,
            actorRole: role,
            returnScanKey: data.returnScanKey,
          }),
        ),
      );
    }
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const data = createTicket.parse(body);
    const ticket = await createLaundryTicket({
      roomId: data.roomId,
      reservationId: data.reservationId,
      guestName: data.guestName,
      express: data.express,
      now: new Date(),
      lines: data.lines,
    });
    return sendJson(httpRes, serialize(ticket));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
