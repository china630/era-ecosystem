import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { createAllotmentBlock, listAllotmentBlocks } from '@/lib/services/allotment-block.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const lineSchema = z.object({
  roomTypeId: z.string().uuid(),
  quantity: z.number().int().positive(),
  ratePlanId: z.string().uuid().optional().nullable(),
});

const createSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().optional(),
  status: z.enum(['TENTATIVE', 'DEFINITE', 'CANCELLED', 'RELEASED']).optional(),
  agencyId: z.string().uuid().optional(),
  salesContractId: z.string().uuid().optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
  cutoffDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/allotment-blocks", async (httpReq, httpRes) => {
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
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as
      | 'TENTATIVE'
      | 'DEFINITE'
      | 'CANCELLED'
      | 'RELEASED'
      | null;
    const agencyId = url.searchParams.get('agencyId') ?? undefined;
    return sendJson(httpRes, 
      serialize(
        await listAllotmentBlocks({
          status: status ?? undefined,
          agencyId,
        }),
      ),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/allotment-blocks", async (httpReq, httpRes) => {
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
    const body = createSchema.parse(httpReq.body);
    const row = await createAllotmentBlock(body);
    return sendJson(httpRes, serialize(row), 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
