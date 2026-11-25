/** Lifted from era-hotel-pms/nest/generated/reservation-groups.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { listGroupReservationsWithBalance } from '@/lib/services/reports.service';
import { createReservationGroup } from '@/lib/services/reservation-group.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().optional(),
  agencyId: z.string().uuid().optional(),
  folioMode: z.enum(['INDIVIDUAL', 'MASTER', 'SPLIT']).optional(),
  allotmentBlockId: z.string().uuid().optional(),
  checkInDate: z.coerce.date().optional(),
  checkOutDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});


@Controller()
export class ReservationGroupsController {
  @Get("api/reservation-groups")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    return sendJson(httpRes, serialize(await listGroupReservationsWithBalance()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/reservation-groups")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createSchema.parse(httpReq.body);
    const group = await createReservationGroup({
      code: body.code,
      name: body.name,
      agencyId: body.agencyId,
      folioMode: body.folioMode,
      allotmentBlockId: body.allotmentBlockId,
      checkInDate: body.checkInDate,
      checkOutDate: body.checkOutDate,
      notes: body.notes,
    });
    return sendJson(httpRes, serialize(group), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
