import { z } from "zod";
import { requireCustomerSession } from "@/lib/api-utils";
import { createCorporateApiKey, isOpenApiPermission, listCorporateApiKeys } from "@/lib/open-api-keys";
import { enterDboStaff, dboNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithDboTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  permissions: z.array(z.string().min(1)).min(1),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/open-api-keys", async (httpReq, httpRes) => {
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

  
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    if (auth.session.channel !== "CORPORATE") {
      return sendJson(httpRes, { error: "Corporate channel required" }, 403);
    }
    const items = await listCorporateApiKeys(auth.session.customerId);
    return sendJson(httpRes, { items });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/open-api-keys", async (httpReq, httpRes) => {
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

  
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    if (auth.session.channel !== "CORPORATE") {
      return sendJson(httpRes, { error: "Corporate channel required" }, 403);
    }
    const body = createSchema.parse(httpReq.body);
    if (!body.permissions.every(isOpenApiPermission)) {
      return sendJson(httpRes, { error: "Unknown permission" }, 400);
    }
    const { row, rawKey } = await createCorporateApiKey({
      customerId: auth.session.customerId,
      permissions: body.permissions,
    });
    return sendJson(httpRes, {
      id: row.id,
      status: row.status,
      permissions: row.permissionsJson,
      rawKey,
      shownOnce: true,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
