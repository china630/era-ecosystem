/** Lifted from nest/generated/admin_product-categories__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getProductCategoryById, updateProductCategory } from "@/lib/product-category.service";
import { z } from "zod";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  revenueCode: z.string().max(32).nullable().optional(),
});


@Controller()
export class AdminProductCategoriesIdController {
  @Patch("api/admin/product-categories/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
