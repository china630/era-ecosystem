/** Lifted from era-hotel-pms/nest/generated/housekeeping_tasks.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { completeTask, listTasks } from '@/lib/services/housekeeping.service';
import { setRoomOOO, setRoomOOS } from '@/lib/services/room.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const completeSchema = z.object({ taskId: z.string().uuid() });
const oooSchema = z.object({ roomId: z.string().uuid(), days: z.number().int().positive(), notes: z.string().optional() });


@Controller()
export class HousekeepingTasksController {
  @Get("api/housekeeping/tasks")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    return sendJson(httpRes, serialize(await listTasks()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/housekeeping/tasks")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = httpReq.body;
    if (body.roomId && body.days) {
      const data = oooSchema.parse(body);
      if (body.kind === 'OOS') {
        return sendJson(httpRes, serialize(await setRoomOOS(data.roomId, data.days, data.notes, { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } })));
      }
      return sendJson(httpRes, serialize(await setRoomOOO(data.roomId, data.days, data.notes, { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } })));
    }
    const data = completeSchema.parse(body);
    return sendJson(httpRes, serialize(await completeTask(data.taskId, 'CLEAN', { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } })));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
