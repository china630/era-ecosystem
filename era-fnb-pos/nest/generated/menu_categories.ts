import { z } from "zod";
import { createMenuCategoryForOutlet, findMenuCategoryByOutletCode, findMenuCategoryByOutletName, listMenuCategoriesWithItemCounts, maxMenuCategorySortOrder } from "@/lib/menu.service";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { requestOrganizationId } from "@/lib/request-organization";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_MENU } from "@/lib/auth/read-permission-sets";
import { categoryCodeFromName } from "@/lib/business-day";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);

const createSchema = z.object({
  outletCode: z.string().min(1).optional(),
  name: z.string().min(1),
  code: codeSchema.optional(),
  sortOrder: z.number().int().optional(),
  revenueCode: z.string().min(1).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/menu/categories", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_MENU);
    if (denied) return denied;
    const categories = await listMenuCategoriesWithItemCounts();
    return sendJson(httpRes, categories);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/menu/categories", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;

    const body = createSchema.parse(httpReq.body);
    const organizationId = requestOrganizationId();
    const outlet = await resolveOpsOutlet(body.outletCode);

    const existing = await findMenuCategoryByOutletName(outlet.id, body.name);
    if (existing) return sendJson(httpRes, { error: "Category already exists" }, 409);

    const maxSort = await maxMenuCategorySortOrder(outlet.id);
    const sortOrder = body.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1;
    const code = (body.code ?? categoryCodeFromName(body.name, `C${sortOrder}`)).toUpperCase();
    const codeTaken = await findMenuCategoryByOutletCode(outlet.id, code);
    if (codeTaken) return sendJson(httpRes, { error: "Category code already exists" }, 409);

    const category = await createMenuCategoryForOutlet({
      organizationId,
      outletId: outlet.id,
      name: body.name,
      code,
      sortOrder,
      revenueCode: body.revenueCode,
    });
    return sendJson(httpRes, category, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
