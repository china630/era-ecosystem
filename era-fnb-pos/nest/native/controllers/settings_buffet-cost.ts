/** Lifted from nest/generated/settings_buffet-cost.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { BUFFET_COST_MODELS, COGS_POSTING_MODES, STAFF_BUFFET_OVERLAPS, STOCKTAKE_POLICIES, WAREHOUSE_COST_CLASSES } from "@/lib/buffet-cost-settings";
import { getBuffetCostSettings, patchBuffetCostSettings, type BuffetCostSettingsPatch } from "@/lib/buffet-cost-settings.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const costModel = z.enum(BUFFET_COST_MODELS);
const overlap = z.enum(STAFF_BUFFET_OVERLAPS);
const cogsMode = z.enum(COGS_POSTING_MODES);
const stocktake = z.enum(STOCKTAKE_POLICIES);

const orgDefaultsSchema = z
  .object({
    buffetCostModel: costModel.optional(),
    staffBuffetOverlap: overlap.optional(),
    overlapPct: z.number().min(0).max(100).optional(),
    cogsPostingMode: cogsMode.optional(),
    inventoryGtThresholdAzn: z.number().min(0).optional(),
    warningVarianceLowPct: z.number().min(1).max(300).optional(),
    warningVarianceHighPct: z.number().min(1).max(300).optional(),
    staffMealAznPerCover: z.number().min(0).optional(),
    productionFactorPctGuest: z.number().min(0).max(100).optional(),
    productionFactorPctStaff: z.number().min(0).max(100).optional(),
    stocktakePolicy: z
      .record(z.enum(WAREHOUSE_COST_CLASSES), stocktake)
      .optional(),
  })
  .strict();

const outletOverrideSchema = z
  .object({
    buffetCostModel: costModel.optional(),
    staffBuffetOverlap: overlap.optional(),
    overlapPct: z.number().min(0).max(100).optional(),
    cogsPostingMode: cogsMode.optional(),
    warningVarianceLowPct: z.number().min(1).max(300).optional(),
    warningVarianceHighPct: z.number().min(1).max(300).optional(),
    productionFactorPctGuest: z.number().min(0).max(100).optional(),
    productionFactorPctStaff: z.number().min(0).max(100).optional(),
  })
  .strict();

/** Require at least one of norms/bands so empty `{}` cannot wipe defaults via PATCH. */
const forecastPackSchema = z
  .object({
    keySkuNorms: z
      .array(
        z.object({
          sku: z.string().min(1),
          name: z.string().min(1),
          unit: z.string().min(1),
          qtyPerGuestNight: z.number().min(0),
          aznPerGuestNight: z.number().min(0),
        }),
      )
      .min(1)
      .optional(),
    bands: z
      .array(
        z.object({
          code: z.string().min(1),
          minGuestNights: z.number().int().min(0),
          maxGuestNights: z.number().int().min(0).nullable(),
        }),
      )
      .min(1)
      .optional(),
  })
  .refine((v) => v.keySkuNorms != null || v.bands != null, {
    message: "forecastPack requires keySkuNorms and/or bands",
  })
  .optional();

const patchSchema = z
  .object({
    orgDefaults: orgDefaultsSchema.optional(),
    outletOverrides: z
      .record(z.string().min(1), outletOverrideSchema.nullable())
      .optional(),
    replaceOutletOverrides: z.boolean().optional(),
    forecastPack: forecastPackSchema,
  })
  .strict();


@Controller()
export class SettingsBuffetCostController {
  @Get("api/settings/buffet-cost")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const settings = await getBuffetCostSettings();
    return sendJson(httpRes, { settings });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }

  @Patch("api/settings/buffet-cost")
  @HttpCode(200)
  async patch_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return sendJson(httpRes, denied.body, denied.status);
    const body = patchSchema.parse(httpReq.body);
    const settings = await patchBuffetCostSettings(
      body as BuffetCostSettingsPatch,
    );
    return sendJson(httpRes, { settings });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "OUTLET_NOT_FOUND"
    ) {
      return sendJson(httpRes, { error: "Outlet not found" }, 404);
    }
    return sendRouteError(httpRes, err);
  }

      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
