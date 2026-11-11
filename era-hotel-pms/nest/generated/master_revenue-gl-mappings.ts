import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { REVENUE_CODE_ROLES } from '@/lib/revenue-code-match';
import { listRevenueGlMappings, setRevenueCodeRole, upsertRevenueGlMapping } from '@/lib/services/revenue-gl-mapping.service';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const upsertSchema = z
  .object({
    revenueCodeId: z.string().uuid(),
    glAccountCode: z.string().min(1).max(20).optional(),
    systemRole: z.enum(REVENUE_CODE_ROLES).nullable().optional(),
  })
  .refine((b) => b.glAccountCode !== undefined || b.systemRole !== undefined, {
    message: 'glAccountCode or systemRole is required',
  });

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/master/revenue-gl-mappings", async (httpReq, httpRes) => {
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

  
    assertMasterDataRead(session, PERMISSIONS.REVENUE_ADMIN);
    return sendJson(httpRes, serialize(await listRevenueGlMappings()));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/master/revenue-gl-mappings", async (httpReq, httpRes) => {
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

  
    assertMasterDataWrite(session, PERMISSIONS.REVENUE_ADMIN);
    const body = upsertSchema.parse(httpReq.body);
    if (body.systemRole !== undefined) {
      await setRevenueCodeRole(body.revenueCodeId, body.systemRole);
    }
    const updated =
      body.glAccountCode !== undefined
        ? await upsertRevenueGlMapping(body.revenueCodeId, body.glAccountCode)
        : null;
    return sendJson(httpRes, serialize(updated ?? { revenueCodeId: body.revenueCodeId }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
