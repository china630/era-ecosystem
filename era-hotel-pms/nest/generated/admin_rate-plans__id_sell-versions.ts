import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { addRatePlanSellVersion, listRatePlanSellVersions } from '@/lib/services/rate-plan-sell-versions.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const postSchema = z.object({
  sellPrice: z.number().positive(),
  costFloor: z.number().min(0).nullable().optional(),
  occupancy: z.number().int().min(1).max(10).optional(),
  roomTypeId: z.string().uuid(),
  mealPlanId: z.string().uuid(),
  effectiveFrom: z.string().min(8),
  seasonId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/rate-plans/:id/sell-versions", async (httpReq, httpRes) => {
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

  
    assertMasterDataRead(session, PERMISSIONS.RATES_ADMIN);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listRatePlanSellVersions(id)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/rate-plans/:id/sell-versions", async (httpReq, httpRes) => {
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
    const body = postSchema.parse(httpReq.body);
    const row = await addRatePlanSellVersion({
      ratePlanId: id,
      sellPrice: body.sellPrice,
      costFloor: body.costFloor,
      occupancy: body.occupancy,
      roomTypeId: body.roomTypeId,
      mealPlanId: body.mealPlanId,
      effectiveFrom: new Date(body.effectiveFrom),
      seasonId: body.seasonId,
      note: body.note,
      createdById: session?.sub,
    });
    return sendJson(httpRes, serialize(row), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
