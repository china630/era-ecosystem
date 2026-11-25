/** Lifted from era-hotel-pms/nest/generated/migration_registrations__id_prefill.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { getMigrationPrefill } from '@/lib/services/migration-registration.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class MigrationRegistrationsIdPrefillController {
  @Get("api/migration/registrations/:id/prefill")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.MIGRATION_REG_READ);
    await requireHotelModule('hotel_migration_pro', session.organizationId);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await getMigrationPrefill(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
