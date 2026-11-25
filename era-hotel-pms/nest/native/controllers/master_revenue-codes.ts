/** Lifted from era-hotel-pms/nest/generated/master_revenue-codes.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { serialize } from '@/lib/serialize';
import { PAYMENT_CATEGORIES } from '@/lib/payment-category';
import { createRevenueCode, listRevenueCodes } from '@/lib/services/master-data.service';
import { scheduleMasterDataSyncDebounced } from '@/lib/integration/master-data-sync-debounce';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { assertAnyPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  ...localizedNameFields,
  taxTag: z.string().optional(),
  departmentId: z.string().uuid(),
  targetFolioType: z.enum(['GUEST', 'COMPANY', 'AGENCY']).optional(),
  allowManualCharge: z.boolean().optional(),
  allowManualPayment: z.boolean().optional(),
  reportType: z.string().max(32).nullable().optional(),
  paymentCategory: z.enum(PAYMENT_CATEGORIES).nullable().optional(),
});


@Controller()
export class MasterRevenueCodesController {
  @Get("api/master/revenue-codes")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertAnyPermission(session, [
      PERMISSIONS.REVENUE_ADMIN,
      PERMISSIONS.REVENUE_CODES_READ,
    ]);
    return sendJson(httpRes, serialize(await listRevenueCodes()));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/master/revenue-codes")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.REVENUE_ADMIN);
    const body = schema.parse(httpReq.body);
    const created = await createRevenueCode(body);
    scheduleMasterDataSyncDebounced();
    return sendJson(httpRes, serialize(created), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
