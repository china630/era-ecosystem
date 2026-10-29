import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  BUFFET_COST_MODELS,
  COGS_POSTING_MODES,
  STAFF_BUFFET_OVERLAPS,
  STOCKTAKE_POLICIES,
  WAREHOUSE_COST_CLASSES,
} from "@/lib/buffet-cost-settings";
import {
  getBuffetCostSettings,
  patchBuffetCostSettings,
  type BuffetCostSettingsPatch,
} from "@/lib/buffet-cost-settings.service";

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

export async function GET() {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return denied;
    const settings = await getBuffetCostSettings();
    return jsonOk({ settings });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return denied;
    const body = patchSchema.parse(await request.json());
    const settings = await patchBuffetCostSettings(
      body as BuffetCostSettingsPatch,
    );
    return jsonOk({ settings });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "OUTLET_NOT_FOUND"
    ) {
      return jsonError("Outlet not found", 404);
    }
    return handleRouteError(err);
  }
}
