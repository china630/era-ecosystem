import { getProductCategoryById, updateProductCategory } from "@/lib/product-category.service";
import { z } from "zod";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  revenueCode: z.string().max(32).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/product-categories/:id", async (httpReq, httpRes) => {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const existing = await getProductCategoryById(id);
    if (!existing) return sendJson(httpRes, { error: "Category not found" }, 404);
    const row = await updateProductCategory(id, {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.revenueCode !== undefined ? { revenueCode: body.revenueCode?.trim() || null } : {}),
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
