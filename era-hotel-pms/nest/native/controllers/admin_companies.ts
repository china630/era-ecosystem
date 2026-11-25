/** Lifted from era-hotel-pms/nest/generated/admin_companies.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listCompanies, upsertCompany } from '@/lib/services/company.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  voen: z.string().optional(),
  settlementMode: z.enum(['PREPAID', 'POSTPAID']).optional(),
  creditLimitAzn: z.number().nullable().optional(),
  paymentTermsDays: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
});


@Controller()
export class AdminCompaniesController {
  @Get("api/admin/companies")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.PARTIES_MANAGE);
    return sendJson(httpRes, serialize(await listCompanies()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/companies")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.PARTIES_MANAGE);
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await upsertCompany(body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
