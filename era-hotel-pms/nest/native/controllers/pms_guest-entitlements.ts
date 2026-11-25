/** Lifted from era-hotel-pms/nest/generated/pms_guest-entitlements.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { getGuestEntitlements } from '@/lib/services/guest-entitlements.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PmsGuestEntitlementsController {
  @Get("api/pms/guest-entitlements")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertPosBridgeOrPermission({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() }, PERMISSIONS.RESERVATIONS_READ);
    const params = requestUrl.searchParams;
    const entitlements = await getGuestEntitlements({
      roomNumber: params.get('roomNumber') ?? undefined,
      reservationId: params.get('reservationId') ?? undefined,
    });
    if (!entitlements) {
      return sendJson(httpRes, { found: false });
    }
    return sendJson(httpRes, serialize({ found: true, ...entitlements }));
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
