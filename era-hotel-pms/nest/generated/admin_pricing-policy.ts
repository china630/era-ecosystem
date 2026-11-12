import { z } from 'zod';
import { getHotelPolicy, updateHotelPolicy } from '@/lib/services/hotel-policy.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  occupancyPricingEnabled: z.boolean().optional(),
  loadBasedPricingEnabled: z.boolean().optional(),
  childAbsolutePricingEnabled: z.boolean().optional(),
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

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/pricing-policy", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertMasterDataRead(session, PERMISSIONS.PRICING_ADMIN);
    return sendJson(httpRes, await getHotelPolicy());
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/pricing-policy", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertMasterDataWrite(session, PERMISSIONS.PRICING_ADMIN);
    const body = patchSchema.parse(httpReq.body);
    const before = await getHotelPolicy();
    const after = await updateHotelPolicy(body);
    await recordHotelAudit(
      { userId: session?.sub, request },
      'HotelPolicy',
      'pricing',
      'UPDATE',
      { before, after },
    );
    return sendJson(httpRes, after);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
