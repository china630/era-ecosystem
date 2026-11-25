/** Lifted from era-hotel-pms/nest/generated/tours_templates.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createTourTemplate, listTourTemplates } from '@/lib/services/tour.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  defaultAgenda: z.string().optional(),
  defaultPickup: z.string().optional(),
  defaultReturn: z.string().optional(),
  defaultCapacity: z.number().int().positive().optional(),
  defaultPrice: z.number().nonnegative(),
});


@Controller()
export class ToursTemplatesController {
  @Get("api/tours/templates")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TOURS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    return sendJson(httpRes, serialize(await listTourTemplates(false)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/tours/templates")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.TOURS_WRITE);
    await requireHotelModule('hotel_transfers', session.organizationId);
    const body = bodySchema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createTourTemplate(body)), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
