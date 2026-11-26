/** Lifted from era-hotel-pms/nest/generated/fo_share-rooming-queue.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { listShareRoomingQueue } from '@/lib/services/share-assignment.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/** FIFO unassigned share-eligible stays for union rooming. */


@Controller()
export class FoShareRoomingQueueController {
  @Get("api/fo/share-rooming-queue")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = requestUrl;
    const roomTypeId = url.searchParams.get('roomTypeId') ?? undefined;
    const gender = url.searchParams.get('gender') as 'M' | 'F' | null;
    const limit = url.searchParams.get('limit');
    const rows = await listShareRoomingQueue({
      roomTypeId,
      gender: gender === 'M' || gender === 'F' ? gender : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendJson(httpRes, serialize(rows));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
