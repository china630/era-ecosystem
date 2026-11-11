import { z } from "zod";
import { isSoldOutSchemaDrift, listMenuItemSoldOutRows, upsertMenuItemSoldOut } from "@/lib/fnb-sold-out";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_SOLD_OUT } from "@/lib/auth/read-permission-sets";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  menuItemId: z.string().min(1),
  outletId: z.string().optional(),
  soldOut: z.boolean(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/menu/sold-out", async (httpReq, httpRes) => {
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
    const denied = denyUnlessAnyPermission(session, TILL_READ_SOLD_OUT);
    if (denied) return denied;
    const outletId =
      new URL(request.url).searchParams.get("outletId") ??
      (await getSelectedOutletId());
    const rows = await listMenuItemSoldOutRows(requestOrganizationId(), outletId ?? undefined);
    return sendJson(httpRes, { soldOut: rows.filter((r) => r.soldOut) });
  } catch (err) {
    if (isSoldOutSchemaDrift(err)) return sendJson(httpRes, { soldOut: [] });
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.put("/api/menu/sold-out", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_SOLD_OUT);
    if (denied) return denied;
    const body = bodySchema.parse(httpReq.body);
    const outletId = body.outletId ?? (await getSelectedOutletId());
    if (!outletId) return sendJson(httpRes, { error: "outletId required" }, 400);
    const organizationId = requestOrganizationId();
    const row = await upsertMenuItemSoldOut({
      organizationId,
      menuItemId: body.menuItemId,
      outletId,
      soldOut: body.soldOut,
    });
    return sendJson(httpRes, row);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
