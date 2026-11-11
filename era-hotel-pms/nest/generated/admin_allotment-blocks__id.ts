import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getAllotmentBlock, getAllotmentBlockPickup, updateAllotmentBlock } from '@/lib/services/allotment-block.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const lineSchema = z.object({
  roomTypeId: z.string().uuid(),
  quantity: z.number().int().positive(),
  ratePlanId: z.string().uuid().optional().nullable(),
});

const patchSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['TENTATIVE', 'DEFINITE', 'CANCELLED', 'RELEASED']).optional(),
  agencyId: z.string().uuid().nullable().optional(),
  salesContractId: z.string().uuid().nullable().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  cutoffDate: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(lineSchema).min(1).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/allotment-blocks/:id", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertMasterDataRead(session, PERMISSIONS.ALLOTMENT_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const { id } = httpReq.params;
    const url = new URL(req.url);
    if (url.searchParams.get('pickup') === '1') {
      const pickup = await getAllotmentBlockPickup(id);
      if (!pickup) return sendJson(httpRes, { error: 'Not found' }, 404);
      return sendJson(httpRes, serialize(pickup));
    }
    const row = await getAllotmentBlock(id);
    if (!row) return sendJson(httpRes, { error: 'Not found' }, 404);
    return sendJson(httpRes, serialize(row));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/allotment-blocks/:id", async (httpReq, httpRes) => {
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

  
    assertMasterDataWrite(session, PERMISSIONS.ALLOTMENT_ADMIN);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const row = await updateAllotmentBlock(id, body);
    return sendJson(httpRes, serialize(row));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
