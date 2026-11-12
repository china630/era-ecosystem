import { z } from 'zod';
import { getSatelliteSession } from '@/lib/auth/session';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { countOpsWipe, runOpsWipe } from '@/lib/services/ops-wipe.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const confirmSchema = z.object({
  organizationId: z.string().uuid(),
  confirmPhrase: z.literal('WIPE'),
  ops: z.array(z.string()).optional(),
});

async function superAdminSession() {
  const session = await getSatelliteSession();
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (!isPlatformSuperAdminUser({ email: session.email ?? null, login: session.login })) {
    throw Object.assign(new Error('Forbidden: platform super admin only'), { status: 403 });
  }
  return session;
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/ops-wipe", async (httpReq, httpRes) => {
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

  
    const session = await superAdminSession();
    return sendJson(httpRes, {
      organizationId: session.organizationId,
      counts: await countOpsWipe(session.organizationId),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/ops-wipe", async (httpReq, httpRes) => {
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

  
    const session = await superAdminSession();
    const body = confirmSchema.parse(httpReq.body);
    if (body.organizationId !== session.organizationId) {
      throw Object.assign(new Error('Organization changed since counts were loaded — reload the page'), {
        status: 409,
      });
    }
    const deleted = await runOpsWipe(
      session.organizationId,
      body.ops ? { ops: body.ops } : undefined,
    );
    await recordHotelAudit({ userId: session.sub, request }, 'OpsWipe', session.organizationId, 'WIPE', {
      deleted,
    });
    return sendJson(httpRes, {
      organizationId: session.organizationId,
      deleted,
      counts: await countOpsWipe(session.organizationId),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
