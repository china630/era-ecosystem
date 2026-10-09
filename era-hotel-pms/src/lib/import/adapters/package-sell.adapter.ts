import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { cellNumber, cellString } from "@/lib/import/helpers";
import { toDecimal } from "@/lib/decimal";
import { roomTypeFamily } from "@/lib/services/nafta-package-compose.service";
import type { ImportAdapter } from "@/lib/import/types";

const rowSchema = z.object({
  packageCode: z.string().min(1),
  packageName: z.string().min(1),
  occupancy: z.number(),
  sellPrice: z.number(),
  season: z.string().optional().nullable(),
  roomType: z.string().optional().nullable(),
  mealPlan: z.string().optional().nullable(),
  desk: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  extraBedAmount: z.number().optional().nullable(),
});

/** ISO date only. Word seasons are not loaded until the hotel confirms the calendar. */
function seasonFrom(season: string | null | undefined): Date | null {
  const raw = (season ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return new Date(`${raw}T00:00:00.000Z`);
}

function isComboCode(code: string): boolean {
  if (/[+,]/.test(code)) return true;
  return code.split(/\s+/).filter((part) => part.startsWith("PKG-")).length > 1;
}

function skipDetoksJuniorTriple(row: {
  packageCode: string;
  occupancy: number;
  sellPrice: number;
  roomType?: string | null;
}): boolean {
  return (
    row.packageCode === "PKG-DETOKS" &&
    row.occupancy === 3 &&
    row.sellPrice === 675 &&
    roomTypeFamily(row.roomType ?? "") === "JUNIOR"
  );
}

export const packageSellAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: "package-sell",
  label: "Package sell (desk)",
  order: 14,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: "14-Package-Sell-2026.xlsx — PDF NAFTA PRICE & PACKAGES LIST (not EW)",
  headerAliases: {
    packageCode: "packageCode",
    packageName: "packageName",
    occupancy: "occupancy",
    sellPrice: "sellPrice",
    season: "season",
    roomType: "roomType",
    mealPlan: "mealPlan",
    desk: "desk",
    source: "source",
    extraBedAmount: "extraBedAmount",
  },
  rowSchema,
  mapRow: (raw) => {
    const packageCode = cellString(raw.packageCode)?.toUpperCase();
    const sellPrice = cellNumber(raw.sellPrice);
    const occupancy = cellNumber(raw.occupancy);
    const desk = (cellString(raw.desk) ?? "Y").toUpperCase();
    if (!packageCode || sellPrice == null || occupancy == null) return null;
    if (desk === "N") return null;
    if (isComboCode(packageCode)) return null;
    return {
      packageCode,
      packageName: cellString(raw.packageName) ?? packageCode,
      occupancy,
      sellPrice,
      season: cellString(raw.season),
      roomType: cellString(raw.roomType),
      mealPlan: cellString(raw.mealPlan),
      desk,
      source: cellString(raw.source),
      extraBedAmount: cellNumber(raw.extraBedAmount),
    };
  },
  upsert: async (tx, row, dryRun) => {
    const effectiveFrom = seasonFrom(row.season);
    if (!effectiveFrom || !row.roomType || skipDetoksJuniorTriple(row)) return "skipped";
    const types = await tx.roomType.findMany({
      select: { id: true, code: true, adultCapacity: true },
    });
    const family = roomTypeFamily(row.roomType);
    const roomType =
      types.find((t) => roomTypeFamily(t.code) === family && family !== "OTHER") ??
      types.find((t) => t.code.toUpperCase() === row.roomType!.toUpperCase());
    if (!roomType || row.occupancy > roomType.adultCapacity) return "skipped";
    const mealCode = (row.mealPlan ?? "FB").toUpperCase();
    const meal = await tx.mealPlan.findFirst({ where: { code: mealCode } });
    if (!meal) return "skipped";
    let plan = await tx.ratePlan.findFirst({ where: { code: row.packageCode } });
    if (dryRun) return plan ? "updated" : "created";
    if (!plan) {
      plan = await tx.ratePlan.create({
        data: {
          code: row.packageCode,
          name: row.packageName,
          type: "DERIVED",
          medicalFlag: true,
          pricePerNight: toDecimal(0),
          mealPlanId: meal.id,
          extraBedAmount: row.extraBedAmount != null ? toDecimal(row.extraBedAmount) : undefined,
          active: true,
        },
      });
    } else {
      await tx.ratePlan.update({
        where: { id: plan.id },
        data: {
          name: row.packageName,
          medicalFlag: true,
          active: true,
          ...(row.extraBedAmount != null ? { extraBedAmount: toDecimal(row.extraBedAmount) } : {}),
        },
      });
    }
    if (!plan) throw new Error(`Rate plan missing: ${row.packageCode}`);
    const note = [row.season, row.roomType, row.source].filter(Boolean).join(" | ") || null;
    const existing = await tx.ratePlanSellVersion.findFirst({
      where: {
        ratePlanId: plan.id,
        roomTypeId: roomType.id,
        mealPlanId: meal.id,
        occupancy: row.occupancy,
        effectiveFrom,
      },
    });
    if (existing) {
      await tx.ratePlanSellVersion.update({
        where: { id: existing.id },
        data: { sellPrice: toDecimal(row.sellPrice), note },
      });
      return "updated";
    }
    await tx.ratePlanSellVersion.updateMany({
      where: {
        ratePlanId: plan.id,
        roomTypeId: roomType.id,
        mealPlanId: meal.id,
        occupancy: row.occupancy,
        effectiveTo: null,
        effectiveFrom: { lt: effectiveFrom },
      },
      data: { effectiveTo: effectiveFrom },
    });
    await tx.ratePlanSellVersion.create({
      data: {
        ratePlanId: plan.id,
        roomTypeId: roomType.id,
        mealPlanId: meal.id,
        sellPrice: toDecimal(row.sellPrice),
        occupancy: row.occupancy,
        effectiveFrom,
        note,
      },
    });
    return "created";
  },
};
