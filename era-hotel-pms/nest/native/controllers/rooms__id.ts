/** Lifted from era-hotel-pms/nest/generated/rooms__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { updateRoomMasterData } from '@/lib/services/room.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  roomTypeId: z.string().uuid().optional(),
  floor: z.number().int().optional(),
  description: z.string().optional().nullable(),
  viewCode: z.string().optional().nullable(),
  bedTypeCode: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  maxBed: z.number().int().optional().nullable(),
  disabled: z.boolean().optional(),
  deleted: z.boolean().optional(),
});


@Controller()
export class RoomsIdController {
  @Patch("api/rooms/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ROOMS_ADMIN);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    if (Object.keys(body).length === 0) {
      throw new Error('No fields to update');
    }
    const room = await updateRoomMasterData(id, body);
    return sendJson(httpRes, serialize(room));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
