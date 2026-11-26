/** Lifted from era-hotel-pms/nest/generated/pms_in-house.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { listInHouseGuests } from '@/lib/services/pms-bridge.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PmsInHouseController {
  @Get("api/pms/in-house")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertPosBridgeOrPermission({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() }, PERMISSIONS.RESERVATIONS_READ);
    const url = requestUrl;
    const query = url.searchParams.get('query') ?? undefined;
    const roomNumber = url.searchParams.get('roomNumber') ?? undefined;
    const limit = url.searchParams.get('limit');
    const guests = await listInHouseGuests({
      query,
      roomNumber,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return sendJson(httpRes, serialize(guests));
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
