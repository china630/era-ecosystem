/** Lifted from era-hotel-pms/nest/generated/master_room-types__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { serialize } from '@/lib/serialize';
import { updateRoomType } from '@/lib/services/master-data.service';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  name: z.string().min(1).optional(),
  ...localizedNameFields,
  baseQuota: z.number().int().positive().optional(),
  overbookAllowance: z.number().int().nonnegative().optional(),
  adultCapacity: z.number().int().optional(),
  standardAdults: z.number().int().min(1).max(10).optional(),
  childCapacity: z.number().int().optional(),
  active: z.boolean().optional(),
});


@Controller()
export class MasterRoomTypesIdController {
  @Patch("api/master/room-types/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.ROOMS_ADMIN);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    const updated = await updateRoomType(id, body, { userId: session?.sub });
    if (body.active === false) {
      await recordHotelAudit(
        { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
        'RoomType',
        id,
        'RETIRE',
        { patch: body },
      );
    }
    return sendJson(httpRes, serialize(updated));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
