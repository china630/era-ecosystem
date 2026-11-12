import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { createPosCashDrop, resolvePosShiftForOps } from "@/lib/shift.service";
import { cashDrawerForShift } from "@/lib/cash-drawer";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const dropSchema = z.object({
  shiftId: z.string().optional(),
  amountAzn: z.number().positive(),
  note: z.string().max(120).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/shifts/drop", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_CLOSE);
    if (denied) return denied;
    const body = dropSchema.parse(httpReq.body);
    const shift = await resolvePosShiftForOps(body.shiftId);
    if (!shift || shift.status !== "OPEN") return sendJson(httpRes, { error: "Open shift not found" }, 404);
    await createPosCashDrop({
      organizationId: requestOrganizationId(),
      shiftId: shift.id,
      amountAzn: body.amountAzn,
      note: body.note?.trim() || null,
    });
    return sendJson(httpRes, await cashDrawerForShift(shift));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
