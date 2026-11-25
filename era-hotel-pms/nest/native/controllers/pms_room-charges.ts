/** Lifted from era-hotel-pms/nest/generated/pms_room-charges.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { findRoomChargeByIdempotencyKey } from '@/lib/services/pms-bridge.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PmsRoomChargesController {
  @Get("api/pms/room-charges")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertPosBridgeOrPermission({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() }, PERMISSIONS.FOLIO_READ);
    const url = requestUrl;
    const key =
      url.searchParams.get('externalTicketId') ??
      url.searchParams.get('idempotencyKey');
    if (!key) {
      throw new Error('externalTicketId or idempotencyKey query required');
    }
    const charge = await findRoomChargeByIdempotencyKey(key);
    if (!charge) {
      throw new Error('Room charge not found for idempotency key');
    }
    return sendJson(httpRes, serialize(charge));
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
