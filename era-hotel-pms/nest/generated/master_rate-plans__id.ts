import { z } from 'zod';
import { localizedNameFields } from '@/lib/catalog-label';
import { serialize } from '@/lib/serialize';
import { deleteRatePlan, updateRatePlan } from '@/lib/services/master-data.service';
import { assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  name: z.string().min(1).optional(),
  ...localizedNameFields,
  pricePerNight: z.number().positive().optional(),
  medicalFlag: z.boolean().optional(),
  roomTypeId: z.string().uuid().nullable().optional(),
  mealPlanId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  baseOccupancy: z.number().int().min(1).max(10).optional(),
  extraAdultAmount: z.number().min(0).nullable().optional(),
  thirdAdultAmount: z.number().min(0).nullable().optional(),
  extraBedAmount: z.number().min(0).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/master/rate-plans/:id", async (httpReq, httpRes) => {
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

  
    assertMasterDataWrite(session, PERMISSIONS.RATES_ADMIN);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await updateRatePlan(id, body)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/master/rate-plans/:id", async (httpReq, httpRes) => {
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

  try {
    assertMasterDataWrite(session, PERMISSIONS.RATES_ADMIN);
    const { id } = httpReq.params;
    await deleteRatePlan(id);
    return sendJson(httpRes, { ok: true });
  } catch (err) {
    const inUse = err as {
      code?: string;
      reservations?: number;
      contracts?: number;
      slices?: number;
      derived?: number;
      message?: string;
    };
    if (inUse?.code === 'RATE_PLAN_IN_USE') {
      return sendJson(httpRes, 
        {
          error: inUse.message,
          code: 'RATE_PLAN_IN_USE',
          reservations: inUse.reservations ?? 0,
          contracts: inUse.contracts ?? 0,
          slices: inUse.slices ?? 0,
          derived: inUse.derived ?? 0,
        }, 409);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
