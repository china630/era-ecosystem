/** Lifted from nest/generated/admin_products__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getProductCacheById, updateProductCategoryId } from "@/lib/product.service";
import { z } from "zod";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const patchSchema = z.object({
  categoryId: z.string().nullable().optional(),
});


@Controller()
export class AdminProductsIdController {
  @Patch("api/admin/products/:id")
  @HttpCode(200)
  async patch_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterRetailStaff(httpReq, httpRes))) return;
    try {
      const session = await retailNestSession(httpReq);
      const web = await runWithRetailTenant(session, async () => {

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = patchSchema.parse(httpReq.body);
    const existing = await getProductCacheById(id);
    if (!existing) return sendJson(httpRes, { error: "Product not found" }, 404);
    const row = await updateProductCategoryId(id, body.categoryId);
    return sendJson(httpRes, row);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
