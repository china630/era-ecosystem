import { NextResponse } from "next/server";
import { z } from "zod";
import { findOutletById } from "@/lib/outlet.service";
import { OUTLET_COOKIE } from "@/lib/outlet-session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { jsonOk } from "@/lib/api-utils";
import { capabilitiesFromOutletRow } from "@/lib/outlet-capabilities";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  outletId: z.string().min(1),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/outlets/select", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    if (session?.pin === true) {
      return sendJson(httpRes, 
        { error: "Forbidden: PIN session cannot rebind outlet" }, 403);
    }
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLET_BIND);
    if (denied) return denied;
    const body = bodySchema.parse(httpReq.body);
    const outlet = await findOutletById(body.outletId);
    if (!outlet?.active) {
      return sendJson(httpRes, { error: "Outlet not found" }, 404);
    }
    const capabilities = capabilitiesFromOutletRow(outlet);
    const res = jsonOk({
      ok: true,
      outletId: outlet.id,
      code: outlet.code,
      capabilities,
    });
    res.cookies.set(OUTLET_COOKIE, outlet.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return sendWebResponse(httpRes, res);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
