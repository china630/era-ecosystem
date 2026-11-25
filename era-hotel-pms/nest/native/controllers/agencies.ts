/** Lifted from era-hotel-pms/nest/generated/agencies.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { listAgencies } from '@/lib/services/agency-ledger.service';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { sessionHasHotelPermission } from '@/lib/auth/permission-check';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AgenciesController {
  @Get("api/agencies")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.BOOKING_AGENCY_PICK,
      PERMISSIONS.SCREEN_DISTRIBUTION,
    ]);
    const rows = await listAgencies();
    const fullLedger = sessionHasHotelPermission(
      {
        login: session!.login,
        email: session!.email,
        role: session!.role,
        permissions: session!.permissions,
        isOwner: session!.isOwner,
      },
      PERMISSIONS.REPORTS_READ,
    );
    const payload = fullLedger
      ? rows
      : rows
          .filter((row) => row.active)
          .map((row) => ({ id: row.id, code: row.code, name: row.name, active: row.active }));
    return sendJson(httpRes, serialize(payload));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
