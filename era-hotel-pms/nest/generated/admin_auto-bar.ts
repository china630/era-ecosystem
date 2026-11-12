import { z } from "zod";
import { previewAutoBar, applyAutoBar } from "@/lib/services/auto-bar-engine.service";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const querySchema = z.object({
  from: z.string(),
  to: z.string(),
  roomTypeId: z.string().optional(),
  baseAmount: z.coerce.number().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/auto-bar", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.YIELD_ADMIN);
    const url = new URL(req.url);
    const params = querySchema.parse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      roomTypeId: url.searchParams.get("roomTypeId") ?? undefined,
      baseAmount: url.searchParams.get("baseAmount") ?? undefined,
    });
    const preview = await previewAutoBar({
      from: new Date(params.from),
      to: new Date(params.to),
      roomTypeId: params.roomTypeId,
      baseAmount: params.baseAmount,
    });
    return sendJson(httpRes, preview);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/auto-bar", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.YIELD_ADMIN);
    const body = querySchema.extend({ dryRun: z.boolean().optional() }).parse(
      httpReq.body,
    );
    const result = await applyAutoBar({
      from: new Date(body.from),
      to: new Date(body.to),
      roomTypeId: body.roomTypeId,
      baseAmount: body.baseAmount,
      dryRun: body.dryRun,
    });
    return sendJson(httpRes, result);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
