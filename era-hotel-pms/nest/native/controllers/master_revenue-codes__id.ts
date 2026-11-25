/** Lifted from era-hotel-pms/nest/generated/master_revenue-codes__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { serialize } from '@/lib/serialize';
import { PAYMENT_CATEGORIES } from '@/lib/payment-category';
import { updateRevenueCode } from '@/lib/services/master-data.service';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({
  name: z.string().min(1).optional(),
  ...localizedNameFields,
  taxTag: z.string().nullable().optional(),
  departmentId: z.string().uuid().optional(),
  targetFolioType: z.enum(['GUEST', 'COMPANY', 'AGENCY']).nullable().optional(),
  active: z.boolean().optional(),
  allowManualCharge: z.boolean().optional(),
  allowManualPayment: z.boolean().optional(),
  reportType: z.string().max(32).nullable().optional(),
  paymentCategory: z.enum(PAYMENT_CATEGORIES).nullable().optional(),
});


@Controller()
export class MasterRevenueCodesIdController {
  @Patch("api/master/revenue-codes/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.REVENUE_ADMIN);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await updateRevenueCode(id, body)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
