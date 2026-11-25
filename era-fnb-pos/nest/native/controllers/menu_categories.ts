/** Lifted from nest/generated/menu_categories.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { createMenuCategoryForOutlet, findMenuCategoryByOutletCode, findMenuCategoryByOutletName, listMenuCategoriesWithItemCounts, maxMenuCategorySortOrder } from "@/lib/menu.service";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { requestOrganizationId } from "@/lib/request-organization";
import { denyUnlessPermission, denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TILL_READ_MENU } from "@/lib/auth/read-permission-sets";
import { categoryCodeFromName } from "@/lib/business-day";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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


@Controller()
export class MenuCategoriesController {
  @Get("api/menu/categories")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessAnyPermission(session, TILL_READ_MENU);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const categories = await listMenuCategoriesWithItemCounts();
    return sendJson(httpRes, categories);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Post("api/menu/categories")
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
