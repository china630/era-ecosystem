/** Lifted from era-hotel-pms/nest/generated/migration_registrations.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createMigrationRegistration } from '@/lib/services/migration-registration.service';
import { listMigrationRegistrations } from '@/lib/services/tourism-registry.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const createSchema = z.object({
  guestId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
});


@Controller()
export class MigrationRegistrationsController {
  @Get("api/migration/registrations")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.MIGRATION_REG_READ);
    await requireHotelModule('hotel_migration_pro', session.organizationId);
    const rows = await listMigrationRegistrations();
    return sendJson(httpRes, serialize(rows));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/migration/registrations")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.MIGRATION_REG_WRITE);
    await requireHotelModule('hotel_migration_pro', session.organizationId);
    const body = createSchema.parse(httpReq.body);
    const row = await createMigrationRegistration(body);
    return sendJson(httpRes, serialize(row), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
