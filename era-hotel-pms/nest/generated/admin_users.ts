import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createUser, listUsers } from '@/lib/services/user.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  login: z.string().min(2),
  fullName: z.string().min(1),
  password: z.string().min(6),
  roleId: z.string().uuid(),
  email: z.string().email().optional(),
  department: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/users", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const users = await listUsers();
    return sendJson(httpRes, 
      serialize(
        users.map((u) => ({
          id: u.id,
          login: u.login,
          fullName: u.fullName,
          email: u.email,
          department: u.department,
          status: u.status,
          isCrossSystem: u.isCrossSystem,
          cpEmploymentId: u.cpEmploymentId,
          positionTitle: u.positionTitle,
          role: u.role.code,
          roleName: u.role.name,
          lastLoginAt: u.lastLoginAt,
        })),
      ),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/users", async (httpReq, httpRes) => {
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
    assertPermission(session, PERMISSIONS.USERS_MANAGE);
    const body = createSchema.parse(httpReq.body);
    const user = await createUser(body);
    return sendJson(httpRes, serialize(user), 201);
  } catch (err) {
    if (err instanceof Error && (err as Error & { code?: string }).code === 'QUOTA_EXCEEDED') {
      return sendJson(httpRes, { error: err.message }, 403);
    }
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return sendJson(httpRes, { error: err.message }, 403);
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
