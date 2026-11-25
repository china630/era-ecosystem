/** Lifted from era-hotel-pms/nest/generated/housekeeping_condition.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { setHousekeepingCondition } from '@/lib/services/room.service';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';
import type { RoomHkCondition } from '@prisma/client';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  roomId: z.string().uuid(),
  hkCondition: z.enum(['DIRTY', 'PICKUP', 'CLEAN', 'INSPECTED']),
});


@Controller()
export class HousekeepingConditionController {
  @Post("api/housekeeping/condition")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [PERMISSIONS.HOUSEKEEPING_MANAGE, PERMISSIONS.ROOMS_STATUS]);
    const body = schema.parse(httpReq.body);
    const allowOccupiedHk = sessionHasHotelPermission(
      {
        login: session.login,
        email: session.email,
        role: session.role,
        permissions: session.permissions,
        isOwner: session.isOwner,
      },
      PERMISSIONS.HOUSEKEEPING_MANAGE,
    );
    const updated = await setHousekeepingCondition(
      body.roomId,
      body.hkCondition as RoomHkCondition,
      { userId: session.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      allowOccupiedHk,
    );
    return sendJson(httpRes, serialize(updated));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
