import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { findFnbLimitHolderByOrg, updateFnbLimitHolderUsedAzn } from "@/lib/limit-holder.service";
import { requestOrganizationId } from "@/lib/request-organization";
import { recordFbAudit } from "@/lib/satellite-audit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({ amount: z.number().positive() });

/** Pay down the holder's debt. The ceiling is usable again only for the settled part. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/admin/limit-holders/:id/settle", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.OUTLETS_MANAGE);
    if (denied) return denied;
    const { id } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const holder = await findFnbLimitHolderByOrg(organizationId, id);
    if (!holder) return sendJson(httpRes, { error: "Limit holder not found" }, 404);
    const used = Number(holder.usedAzn);
    if (body.amount > used + 0.001) return sendJson(httpRes, { error: "Settlement is above the open debt" }, 400);
    const next = Math.max(0, Math.round((used - body.amount) * 100) / 100);
    const updated = await updateFnbLimitHolderUsedAzn(id, next);
    await recordFbAudit({ userId: session?.sub, request }, "FnbLimitHolder", id, "SETTLE", {
      amount: body.amount,
      usedAzn: next,
    });
    return sendJson(httpRes, {
      id: updated.id,
      usedAzn: next,
      availableAzn: Math.round((Number(updated.ceilingAzn) - next) * 100) / 100,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
