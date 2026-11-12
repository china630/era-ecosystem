import { NextResponse } from "next/server";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { createManualEater, listManagementEaters, syncManagementEatersFromHr } from "@/lib/buffet-management-eaters.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sync"),
    outletId: z.string().min(1).nullable().optional(),
  }),
  z.object({
    action: z.literal("manual"),
    displayLabel: z.string().min(1).max(200),
    outletId: z.string().min(1).nullable().optional(),
  }),
]);

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/buffet/management-eaters", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const outletId = new URL(request.url).searchParams.get("outletId");
    const eaters = await listManagementEaters(outletId || undefined);
    return sendJson(httpRes, { eaters });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/buffet/management-eaters", async (httpReq, httpRes) => {
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

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = postSchema.parse(httpReq.body);
    if (body.action === "sync") {
      const result = await syncManagementEatersFromHr(body.outletId);
      return sendJson(httpRes, result);
    }
    const eaters = await createManualEater({
      displayLabel: body.displayLabel,
      outletId: body.outletId,
    });
    return sendJson(httpRes, { eaters }, 201);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "ORCH_UNAVAILABLE") {
        return sendJson(httpRes, 
          { error: "Workforce leadership sync unavailable", code: "ORCH_UNAVAILABLE" }, 503);
      }
      if (code === "LABEL_REQUIRED") return sendJson(httpRes, { error: "Label required" }, 400);
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
