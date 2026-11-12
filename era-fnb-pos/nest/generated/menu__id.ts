import { z } from "zod";
import { findMenuItemById, softDeactivateMenuItem, updateMenuItemWithOptionalPrice } from "@/lib/menu.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  plu: z.string().min(1).optional(),
  priceAzn: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
  categoryId: z.string().min(1).optional(),
  recipeSku: z.string().min(1).nullable().optional(),
  financeSku: z.string().min(1).nullable().optional(),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  priceReason: z.string().max(200).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/menu/:id", async (httpReq, httpRes) => {
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
    const existing = await findMenuItemById(id);
    if (!existing) return sendJson(httpRes, { error: "Menu item not found" }, 404);

    const imageUrl =
      body.imageUrl === undefined
        ? undefined
        : body.imageUrl === "" || body.imageUrl === null
          ? null
          : body.imageUrl;

    const priceChanged =
      body.priceAzn !== undefined &&
      Number(body.priceAzn) !== Number(existing.priceAzn);

    const item = await updateMenuItemWithOptionalPrice({
      id,
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.plu !== undefined ? { plu: body.plu } : {}),
        ...(body.priceAzn !== undefined ? { priceAzn: body.priceAzn } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.recipeSku !== undefined ? { recipeSku: body.recipeSku } : {}),
        ...(body.financeSku !== undefined ? { financeSku: body.financeSku } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
      },
      priceChanged,
      priceAzn: body.priceAzn,
      priceReason: body.priceReason ?? null,
      createdBy: session?.login ?? session?.sub ?? null,
    });

    return sendJson(httpRes, item);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/menu/:id", async (httpReq, httpRes) => {
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
    const existing = await findMenuItemById(id);
    if (!existing) return sendJson(httpRes, { error: "Menu item not found" }, 404);

    const item = await softDeactivateMenuItem(id);
    return sendJson(httpRes, item);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
