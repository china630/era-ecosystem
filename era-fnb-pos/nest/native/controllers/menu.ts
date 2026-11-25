/** Lifted from nest/generated/menu.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
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
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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


@Controller()
export class MenuController {
  @Get("api/menu")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_MENU);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/menu")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
