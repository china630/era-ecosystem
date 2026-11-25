/** Lifted from era-hotel-pms/nest/generated/migration__id_submit.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { submitMigrationToRegistry, exportMigrationPayload } from '@/lib/services/tourism-registry.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class MigrationIdSubmitController {
  @Post("api/migration/:id/submit")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.MIGRATION_REG_WRITE);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await submitMigrationToRegistry(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Get("api/migration/:id/submit")
  @HttpCode(200)
  async get_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.MIGRATION_REG_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await exportMigrationPayload(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
