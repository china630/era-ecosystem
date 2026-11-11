import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { getPosShiftStatus, reportPosShiftStatus } from '@/lib/services/pms-bridge.service';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterRequestTenant } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const putSchema = z.object({
  outletCode: z.string().min(1),
  shiftId: z.string().min(1),
  status: z.enum(['OPEN', 'CLOSED']),
  propertyCode: z.string().optional(),
  openedAt: z.string().optional(),
  closedAt: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/pms/pos-shift-status", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    await assertPosBridgeOrPermission(request, PERMISSIONS.NIGHT_AUDIT_RUN);
    return sendJson(httpRes, serialize(await getPosShiftStatus()));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/pms/pos-shift-status", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    await assertPosBridgeOrPermission(request, PERMISSIONS.NIGHT_AUDIT_RUN);
    const organizationId = request.headers.get('x-era-organization-id')?.trim() ?? '';
    if (!organizationId || organizationId === 'demo-org') {
      return sendJson(httpRes, { error: 'organizationId required' }, 400);
    }
    enterRequestTenant(organizationId);
    const body = putSchema.parse(httpReq.body);
    await reportPosShiftStatus({
      outletCode: body.outletCode,
      shiftId: body.shiftId,
      status: body.status,
      propertyCode: body.propertyCode,
      openedAt: body.openedAt,
      closedAt: body.closedAt,
    });
    return new Response(null, { status: 204 });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
