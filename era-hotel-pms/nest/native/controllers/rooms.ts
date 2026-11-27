/** Lifted from era-hotel-pms/nest/generated/rooms.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createRoom, listRoomsMaster } from '@/lib/services/room.service';
import { listRoomsForRack } from '@/lib/services/room-rack.service';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  roomNumber: z.string().min(1),
  roomTypeId: z.string().uuid(),
  floor: z.number().int().optional(),
  description: z.string().optional(),
  viewCode: z.string().optional(),
  bedTypeCode: z.string().optional(),
  location: z.string().optional(),
  maxBed: z.number().int().optional(),
});


@Controller()
export class RoomsController {
  @Get("api/rooms")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    const scope = requestUrl.searchParams.get('scope');
    if (scope === 'master') {
      assertPermission(session, PERMISSIONS.ROOMS_ADMIN);
      return sendJson(httpRes, serialize(await listRoomsMaster()));
    }
    assertAnyPermission(session, [
      PERMISSIONS.ROOMS_LIST,
      PERMISSIONS.ROOMS_STATUS,
      PERMISSIONS.HOUSEKEEPING_MANAGE,
    ]);
    const rooms = await listRoomsForRack();
    return sendJson(httpRes, serialize(rooms));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/rooms")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.ROOMS_ADMIN);
    const body = createSchema.parse(httpReq.body);
    const room = await createRoom(body);
    return sendJson(httpRes, serialize(room), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
