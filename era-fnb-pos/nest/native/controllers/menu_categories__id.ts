/** Lifted from nest/generated/menu_categories__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { deleteMenuCategory, findMenuCategoryById, findMenuCategoryByOutletCodeExcluding, findMenuCategoryWithItemCount, updateMenuCategory } from "@/lib/menu.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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


@Controller()
export class MenuCategoriesIdController {
  @Patch("api/menu/categories/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Delete("api/menu/categories/:id")
  @HttpCode(200)
  async delete_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id } = httpReq.params;
    const existing = await findMenuCategoryWithItemCount(id);
    if (!existing) return sendJson(httpRes, { error: "Category not found" }, 404);
    if (existing._count.items > 0) {
      return sendJson(httpRes, { error: "Category has items — move or deactivate them first" }, 400);
    }

    await deleteMenuCategory(id);
    return sendJson(httpRes, { ok: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
