import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { z } from "zod";
import { createMenuCategoryForOutlet, createMenuItemWithInitialPrice, findDailyMenuItemIds, findMenuCategoryById, findMenuCategoryByOutletAndName, listMenuCategoriesWithItems } from "@/lib/menu.service";
import { findOpsOutlet, resolveOpsOutlet } from "@/lib/outlet-helpers";
import { requestOrganizationId } from "@/lib/request-organization";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_MENU } from "@/lib/auth/read-permission-sets";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";
import { categoryCodeFromName } from "@/lib/business-day";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  outletCode: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().min(1).optional(),
  plu: z.string().min(1),
  name: z.string().min(1),
  priceAzn: z.number().nonnegative(),
  active: z.boolean().optional(),
  recipeSku: z.string().min(1).nullable().optional(),
  financeSku: z.string().min(1).nullable().optional(),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/menu", async (httpReq, httpRes) => {
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
    const url = new URL(request.url);
    const dailyOnly = url.searchParams.get("dailyOnly") === "true";
    const outletCodeParam = url.searchParams.get("outletCode");
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    if (
      includeInactive &&
      !(
        session &&
        sessionHasFnbPermission(
          {
            login: session.login,
            email: session.email,
            role: session.role,
            permissions: session.permissions,
            isOwner: session.isOwner,
            pin: session.pin,
          },
          PERMISSIONS.MENU_MANAGE,
        )
      )
    ) {
      return sendJson(httpRes, { error: "Forbidden: includeInactive requires api:menu.manage" }, 403);
    }

    const categories = await listMenuCategoriesWithItems(includeInactive);

    if (!dailyOnly) {
      return sendJson(httpRes, categories);
    }

    const outlet = await findOpsOutlet(outletCodeParam);
    if (!outlet) return sendJson(httpRes, categories);

    const boardDate = bakuCivilUtcDate(todayBakuYmd());
    const boardIds = new Set(
      (await findDailyMenuItemIds(outlet.id, boardDate)).map((e) => e.menuItemId),
    );

    if (boardIds.size === 0) return sendJson(httpRes, categories);

    const filtered = categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((i) => boardIds.has(i.id)),
      }))
      .filter((cat) => cat.items.length > 0);

    return sendJson(httpRes, filtered);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/menu", async (httpReq, httpRes) => {
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

    let category =
      body.categoryId != null
        ? await findMenuCategoryById(body.categoryId)
        : null;
    if (!category && body.categoryName) {
      category = await findMenuCategoryByOutletAndName(outlet.id, body.categoryName);
      if (!category) {
        category = await createMenuCategoryForOutlet({
          organizationId,
          outletId: outlet.id,
          name: body.categoryName,
          code: categoryCodeFromName(body.categoryName, "C99"),
          sortOrder: 99,
        });
      }
    }
    if (!category) {
      return sendJson(httpRes, { error: "categoryId or categoryName required" }, 400);
    }

    const imageUrl =
      body.imageUrl === "" || body.imageUrl === undefined
        ? null
        : body.imageUrl;

    const item = await createMenuItemWithInitialPrice({
      organizationId,
      categoryId: category.id,
      plu: body.plu,
      name: body.name,
      priceAzn: body.priceAzn,
      active: body.active ?? true,
      recipeSku: body.recipeSku ?? null,
      financeSku: body.financeSku ?? null,
      imageUrl,
      createdBy: session?.login ?? session?.sub ?? null,
    });

    return sendJson(httpRes, item, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
