import { z } from "zod";
import { deleteMenuCategory, findMenuCategoryById, findMenuCategoryByOutletCodeExcluding, findMenuCategoryWithItemCount, updateMenuCategory } from "@/lib/menu.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  code: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .optional(),
  sortOrder: z.number().int().optional(),
  revenueCode: z.string().min(1).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/menu/categories/:id", async (httpReq, httpRes) => {
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

    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const existing = await findMenuCategoryById(id);
    if (!existing) return sendJson(httpRes, { error: "Category not found" }, 404);

    const code = body.code?.toUpperCase();
    if (code) {
      const codeTaken = await findMenuCategoryByOutletCodeExcluding(
        existing.outletId,
        code,
        id,
      );
      if (codeTaken) return sendJson(httpRes, { error: "Category code already exists" }, 409);
    }
    const category = await updateMenuCategory(id, {
      ...(body.name ? { name: body.name } : {}),
      ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
      ...(code ? { code } : {}),
      ...(body.revenueCode !== undefined ? { revenueCode: body.revenueCode?.trim() || null } : {}),
    });
    return sendJson(httpRes, category);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/menu/categories/:id", async (httpReq, httpRes) => {
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

    const { id } = httpReq.params;
    const existing = await findMenuCategoryWithItemCount(id);
    if (!existing) return sendJson(httpRes, { error: "Category not found" }, 404);
    if (existing._count.items > 0) {
      return sendJson(httpRes, { error: "Category has items — move or deactivate them first" }, 400);
    }

    await deleteMenuCategory(id);
    return sendJson(httpRes, { ok: true });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
