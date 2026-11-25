/** Lifted from era-hotel-pms/nest/generated/housekeeping_maids.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { assignTaskHousekeeper, createHousekeeper, deactivateHousekeeper, listHousekeepers, updateHousekeeperDepartment } from '@/lib/services/wave-b-master.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  globalPersonId: z.string().uuid(),
  name: z.string().min(1),
  department: z.enum(['ROOMS', 'PUBLIC_AREA', 'LAUNDRY']).optional(),
});
const assignSchema = z.object({ taskId: z.string().uuid(), housekeeperId: z.string().uuid().nullable() });
const patchSchema = z.object({
  id: z.string().uuid(),
  department: z.enum(['ROOMS', 'PUBLIC_AREA', 'LAUNDRY']).optional(),
  active: z.literal(false).optional(),
});


@Controller()
export class HousekeepingMaidsController {
  @Get("api/housekeeping/maids")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return sendJson(httpRes, serialize(await listHousekeepers()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/housekeeping/maids")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = httpReq.body;
    if (body.taskId) {
      const parsed = assignSchema.parse(body);
      return sendJson(httpRes, serialize(await assignTaskHousekeeper(parsed.taskId, parsed.housekeeperId)));
    }
    if (body.id && (body.department != null || body.active === false)) {
      const parsed = patchSchema.parse(body);
      if (parsed.active === false) {
        return sendJson(httpRes, serialize(await deactivateHousekeeper(parsed.id)));
      }
      if (parsed.department) {
        return sendJson(httpRes, serialize(await updateHousekeeperDepartment(parsed.id, parsed.department)));
      }
    }
    const parsed = createSchema.parse(body);
    return sendJson(httpRes, serialize(await createHousekeeper(parsed)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
