/** Lifted from nest/generated/menu__id.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { findMenuItemById, softDeactivateMenuItem, updateMenuItemWithOptionalPrice } from "@/lib/menu.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

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


@Controller()
export class MenuIdController {
  @Patch("api/menu/:id")
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
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Delete("api/menu/:id")
  @HttpCode(200)
  async delete_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return sendJson(httpRes, denied.body, denied.status);

    const { id } = httpReq.params;
    const existing = await findMenuItemById(id);
    if (!existing) return sendJson(httpRes, { error: "Menu item not found" }, 404);

    const item = await softDeactivateMenuItem(id);
    return sendJson(httpRes, item);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
