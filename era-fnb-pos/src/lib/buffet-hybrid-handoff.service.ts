import {
  exportBuffetCostRunSlice,
  loadOutletPosLinesForCostRun,
} from "@/lib/buffet-cost-run-export.service";
import { getBuffetForecastPackReport } from "@/lib/buffet-forecast-pack.service";
import {
  getBuffetCostSettings,
  getEffectiveBuffetCostForOutlet,
} from "@/lib/buffet-cost-settings.service";
import { resolveUnitCogsBySkuFromFinance } from "@/lib/buffet-finance-unit-cogs";
import { sumStaffCoversForPeriod } from "@/lib/buffet-staff-meal.service";
import { buildFinanceHandoffQuery } from "@/lib/buffet-handoff-query";
import { requestOrganizationId } from "@/lib/request-organization";
import { prisma } from "@/lib/prisma";

export type ChefWarningCode =
  | "MODEL_OFF"
  | "NO_GUEST_NIGHTS"
  | "NORMS_ALL_ZERO"
  | "STAFF_GROSS_ZERO"
  | "MISSING_UNIT_COGS"
  | "MISSING_RECIPE_SKU"
  | "FINANCE_CATALOG_UNAVAILABLE"
  | "FINANCE_URL_MISSING"
  | "OUTLET_CODE_MISMATCH";

export type ChefWarning = {
  code: ChefWarningCode;
  message: string;
  count?: number;
};

export type HybridHandoffArgs = {
  outletId: string;
  fromYmd: string;
  toYmd: string;
  /**
   * Optional staff meal gross AZN override for overlap netting.
   * When omitted, computed from staff plan covers × staffMealAznPerCover.
   */
  staffGrossAzn?: number;
  /** When true, `staffGrossAzn` was explicitly provided (incl. 0). */
  staffGrossOverride?: boolean;
  /** When set, surfaces FINANCE_URL_MISSING if empty. */
  financeWebUrl?: string | null;
};

/**
 * Compose POS/COMP/staff + Forecast theoretical for Finance HYBRID deep-link.
 * FOOD usage SoT remains Finance — F&B does not require foodUsage for this path.
 */
export async function buildHybridHandoffPack(args: HybridHandoffArgs) {
  const organizationId = requestOrganizationId();
  if (args.fromYmd > args.toYmd) {
    throw Object.assign(new Error("INVALID_DATE_RANGE"), { code: "INVALID_DATE_RANGE" });
  }

  const outlet = await prisma.outlet.findFirst({
    where: { id: args.outletId, organizationId },
    select: { id: true, code: true, name: true },
  });
  if (!outlet) {
    throw Object.assign(new Error("OUTLET_NOT_FOUND"), { code: "OUTLET_NOT_FOUND" });
  }

  const settings = await getBuffetCostSettings(organizationId);
  const rate = settings.orgDefaults.staffMealAznPerCover;
  const staffCovers = await sumStaffCoversForPeriod({
    outletId: args.outletId,
    fromYmd: args.fromYmd,
    toYmd: args.toYmd,
    organizationId,
  });
  const staffGrossComputed = Math.round(staffCovers.coversStaffTotal * rate * 100) / 100;
  const staffGrossAzn =
    args.staffGrossOverride &&
    args.staffGrossAzn != null &&
    Number.isFinite(Number(args.staffGrossAzn))
      ? Math.max(0, Number(args.staffGrossAzn))
      : staffGrossComputed;

  const posLines = await loadOutletPosLinesForCostRun({
    outletId: args.outletId,
    fromYmd: args.fromYmd,
    toYmd: args.toYmd,
    organizationId,
  });
  const recipeSkus = posLines
    .map((l) => l.recipeSku)
    .filter((s): s is string => Boolean(s?.trim()));
  const cogsLookup = await resolveUnitCogsBySkuFromFinance({
    organizationId,
    recipeSkus,
  });

  // foodUsageAzn=0: chef path residual lives on Finance; still nets staff for handoff.
  const exportSlice = await exportBuffetCostRunSlice({
    outletId: args.outletId,
    fromYmd: args.fromYmd,
    toYmd: args.toYmd,
    foodUsageAzn: 0,
    staffGrossAzn,
    unitCogsBySku: cogsLookup.unitCogsBySku,
  });

  const forecast = await getBuffetForecastPackReport({
    fromYmd: args.fromYmd,
    toYmd: args.toYmd,
    organizationId,
  });

  const theoreticalBySku: Record<string, number> = {};
  for (const line of forecast.lines) {
    theoreticalBySku[line.sku] = line.forecastAzn;
  }

  const effective = await getEffectiveBuffetCostForOutlet(args.outletId, organizationId);
  const chefWarnings: ChefWarning[] = [];

  if (effective.buffetCostModel === "OFF") {
    chefWarnings.push({
      code: "MODEL_OFF",
      message: "Outlet buffet cost model is OFF — HYBRID residual is not a buffet claim.",
    });
  }
  if (forecast.guestNightsStored <= 0 && forecast.guestNights <= 0) {
    chefWarnings.push({
      code: "NO_GUEST_NIGHTS",
      message: "No guest-nights stored for this period — theoretical will be 0.",
    });
  }
  const normsAllZero =
    forecast.forecastPack.keySkuNorms.length === 0 ||
    forecast.forecastPack.keySkuNorms.every((n) => n.aznPerGuestNight <= 0);
  if (normsAllZero) {
    chefWarnings.push({
      code: "NORMS_ALL_ZERO",
      message: "All key SKU AZN norms are 0 — set Forecast pack norms before trusting theoretical.",
    });
  }
  if (staffGrossAzn <= 0) {
    chefWarnings.push({
      code: "STAFF_GROSS_ZERO",
      message: "Staff gross AZN is 0 — staff net will be 0 (informational).",
    });
  }
  if (cogsLookup.source === "unavailable" && recipeSkus.length > 0) {
    chefWarnings.push({
      code: "FINANCE_CATALOG_UNAVAILABLE",
      message:
        "Finance product catalog unavailable — COMP/sale COGS not priced (set ERA_FINANCE_API_URL + service token).",
    });
  }
  const missingRecipe = exportSlice.pos.warnings.filter((w) => w.code === "MISSING_RECIPE_SKU");
  if (missingRecipe.length > 0) {
    chefWarnings.push({
      code: "MISSING_RECIPE_SKU",
      message:
        "Some COMP/sale lines have no recipeSku — set Finance SKU on menu items before trusting attributed COGS.",
      count: missingRecipe.length,
    });
  }
  const missingCogs = exportSlice.pos.warnings.filter((w) => w.code === "MISSING_UNIT_COGS");
  if (missingCogs.length > 0 || cogsLookup.missingSkus.length > 0) {
    chefWarnings.push({
      code: "MISSING_UNIT_COGS",
      message: "Some POS lines lack unit COGS — COMP/sale may understate attributed.",
      count: Math.max(missingCogs.length, cogsLookup.missingSkus.length),
    });
  }
  const financeUrl = args.financeWebUrl?.trim() ?? "";
  if (!financeUrl) {
    chefWarnings.push({
      code: "FINANCE_URL_MISSING",
      message:
        "Finance web URL is not set in Settings — Open Finance CTA unavailable.",
    });
  }

  const theoreticalAzn = forecast.totalForecastAzn;
  const financeHandoffQuery = buildFinanceHandoffQuery({
    from: args.fromYmd,
    to: args.toYmd,
    outletCode: outlet.code,
    posSaleAzn: exportSlice.pos.saleAttributedAzn,
    posCompAzn: exportSlice.pos.compAttributedAzn,
    staffNetAzn: exportSlice.staffNet,
    theoreticalAzn,
    theoreticalBySku,
  });

  return {
    outlet: {
      id: outlet.id,
      code: outlet.code,
      name: outlet.name,
    },
    period: { from: args.fromYmd, to: args.toYmd },
    buffetCostModel: effective.buffetCostModel,
    pos: {
      saleAttributedAzn: exportSlice.pos.saleAttributedAzn,
      compAttributedAzn: exportSlice.pos.compAttributedAzn,
      posAttributedAzn: exportSlice.pos.posAttributedAzn,
      saleLineCount: exportSlice.pos.saleLineCount,
      compLineCount: exportSlice.pos.compLineCount,
      warnings: exportSlice.pos.warnings,
    },
    staff: {
      staffGross: exportSlice.staffGross,
      staffGrossComputed,
      staffCoversTotal: staffCovers.coversStaffTotal,
      staffMealAznPerCover: rate,
      staffGrossSource: args.staffGrossOverride ? "OVERRIDE" : "COMPUTED",
      staffNet: exportSlice.staffNet,
      buffetCoveredFromStaff: exportSlice.buffetCoveredFromStaff,
      overlap: exportSlice.overlap,
    },
    theoretical: {
      guestNights: forecast.guestNights,
      guestNightsStored: forecast.guestNightsStored,
      bandCode: forecast.bandCode,
      theoreticalAzn,
      theoreticalBySku,
      lines: forecast.lines,
      warnings: normsAllZero || forecast.guestNights <= 0
        ? [
            ...(forecast.guestNights <= 0 ? ["NO_GUEST_NIGHTS"] : []),
            ...(normsAllZero ? ["NORMS_ALL_ZERO"] : []),
          ]
        : [],
    },
    financeHandoffQuery,
    financeWebUrl: financeUrl || null,
    chefWarnings,
  };
}
