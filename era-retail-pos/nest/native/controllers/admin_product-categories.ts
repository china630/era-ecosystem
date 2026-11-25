/** Lifted from nest/generated/admin_product-categories.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { requestOrganizationId } from "@/lib/request-organization";
import { createProductCategory, listProductCategories } from "@/lib/product-category.service";
import { z } from "zod";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const writeSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  revenueCode: z.string().max(32).nullable().optional(),
});


@Controller()
export class AdminProductCategoriesController {
  @Get("api/admin/product-categories")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const rows = await listProductCategories();
    return sendJson(httpRes, { categories: rows });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/product-categories")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = writeSchema.parse(httpReq.body);
    const row = await createProductCategory({
      organizationId: requestOrganizationId(),
      code: body.code.trim(),
      name: body.name.trim(),
      revenueCode: body.revenueCode?.trim() || null,
    });
    return sendJson(httpRes, row, 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
