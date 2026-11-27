/** Lifted from era-hotel-pms/nest/generated/admin_pricing-policy.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { getHotelPolicy, updateHotelPolicy } from '@/lib/services/hotel-policy.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  occupancyPricingEnabled: z.boolean().optional(),
  loadBasedPricingEnabled: z.boolean().optional(),
  childAbsolutePricingEnabled: z.boolean().optional(),
  yieldAppliesToPackages: z.boolean().optional(),
  manualNightOverrideEnabled: z.boolean().optional(),
  barPricingEnabled: z.boolean().optional(),
  dailyRatesEnabled: z.boolean().optional(),
  standardCheckInTime: z.string().optional(),
  standardCheckOutTime: z.string().optional(),
  earlyCheckInFeeMode: z.enum(['FIXED', 'PERCENT_OF_NIGHT', 'HOURLY']).optional(),
  earlyCheckInFeeAmount: z.number().optional(),
  lateCheckOutFeeMode: z.enum(['FIXED', 'PERCENT_OF_NIGHT', 'HOURLY']).optional(),
  lateCheckOutFeeAmount: z.number().optional(),
  cityLedgerMissingCounterparty: z
    .enum(['BLOCK_CHECKOUT', 'DEFER_HANDOFF', 'AUTO_CREATE'])
    .optional(),
  yearEndBlockIfOpenCityLedger: z.boolean().optional(),
  stopIfZeroNightPrice: z.boolean().optional(),
  autoNoShow: z.boolean().optional(),
  stopIfGuestFolioBalance: z.boolean().optional(),
  autoExtendUndeparted: z.boolean().optional(),
  checkCheckedOutFolios: z.boolean().optional(),
  cancelRoomChangePlans: z.boolean().optional(),
  agencyPortalAutoConfirm: z.boolean().optional(),
  agencyPortalOptionHoldHours: z.number().int().min(1).max(720).optional(),
});


@Controller()
export class AdminPricingPolicyController {
  @Get("api/admin/pricing-policy")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.PRICING_ADMIN);
    return sendJson(httpRes, await getHotelPolicy());
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Patch("api/admin/pricing-policy")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.PRICING_ADMIN);
    const body = patchSchema.parse(httpReq.body);
    const before = await getHotelPolicy();
    const after = await updateHotelPolicy(body);
    await recordHotelAudit(
      { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      'HotelPolicy',
      'pricing',
      'UPDATE',
      { before, after },
    );
    return sendJson(httpRes, after);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
