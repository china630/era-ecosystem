import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { upsertBuffetLine } from "@/lib/buffet-planner";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  menuItemId: z.string().min(1),
  station: z.string().min(1).max(64).default("MAIN"),
  plannedPortions: z.number().int().min(1).max(20000),
  wastePct: z.number().min(0).max(100).default(0),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/admin/buffet/plans/:id/lines", async (httpReq, httpRes) => {
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
    const { id: planId } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const plan = await upsertBuffetLine({ planId, ...body });
    return sendJson(httpRes, plan);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "PLAN_NOT_FOUND") return sendJson(httpRes, { error: "Plan not found" }, 404);
      if (code === "PLAN_NOT_DRAFT") return sendJson(httpRes, { error: "Only draft plans can be edited" }, 409);
      if (code === "MENU_ITEM_NOT_FOUND") return sendJson(httpRes, { error: "Menu item not found on this outlet" }, 404);
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
