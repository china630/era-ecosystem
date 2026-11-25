/** Lifted from era-hotel-pms/nest/generated/admin_pricing-components.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serialize } from '@/lib/serialize';
import { assertMasterDataRead } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listPricingComponents, recommendedBoardAddOns } from '@/lib/services/pricing-components.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class AdminPricingComponentsController {
  @Get("api/admin/pricing-components")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.PRICING_ADMIN);
    const asOfParam = requestUrl.searchParams.get('asOf');
    const asOf = asOfParam ? new Date(asOfParam) : undefined;
    const [components, recommended] = await Promise.all([
      listPricingComponents(asOf),
      recommendedBoardAddOns(asOf),
    ]);
    return sendJson(httpRes, serialize({ components, recommended }));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
