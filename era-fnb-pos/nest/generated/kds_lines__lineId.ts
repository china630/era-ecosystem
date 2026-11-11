import { NextResponse } from "next/server";
import { z } from "zod";
import { findTicketLineById, updateTicketLineKitchenStatus } from "@/lib/kds.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  kitchenStatus: z.enum(["IN_PREP", "DONE"]),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/kds/lines/:lineId", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.KDS_BUMP);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_kitchen_kds", session?.organizationId);

    const { lineId } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);

    const line = await findTicketLineById(lineId);
    if (!line) {
      return sendJson(httpRes, { error: "Line not found" }, 404);
    }
    if (!["FIRED", "IN_PREP"].includes(line.kitchenStatus)) {
      return sendJson(httpRes, 
        { error: "Line must be FIRED or IN_PREP to bump" }, 400);
    }

    const updated = await updateTicketLineKitchenStatus(
      lineId,
      body.kitchenStatus,
    );

    return sendJson(httpRes, updated);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
