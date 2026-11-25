/** Lifted from era-hotel-pms/nest/generated/reservation-groups_assign.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { assignReservationToGroup } from '@/lib/services/reservation-group.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  reservationId: z.string().uuid(),
  groupId: z.string().uuid().nullable(),
});


@Controller()
export class ReservationGroupsAssignController {
  @Patch("api/reservation-groups/assign")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = schema.parse(httpReq.body);
    const updated = await assignReservationToGroup(body.reservationId, body.groupId);
    return sendJson(httpRes, serialize(updated));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
