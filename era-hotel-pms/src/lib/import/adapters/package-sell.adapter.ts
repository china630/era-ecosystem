import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { cellNumber, cellString } from "@/lib/import/helpers";
import { toDecimal } from "@/lib/decimal";
import type { ImportAdapter } from "@/lib/import/types";

const rowSchema = z.object({
  packageCode: z.string().min(1),
  packageName: z.string().min(1),
  occupancy: z.number(),
  sellPrice: z.number(),
  season: z.string().optional().nullable(),
  roomType: z.string().optional().nullable(),
  desk: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  extraBedAmount: z.number().optional().nullable(),
});

function seasonFrom(season: string | null | undefined): Date {
  if (/low|nov|apr/i.test(season ?? "")) return new Date("2025-11-01T00:00:00.000Z");
  return new Date("2026-05-01T00:00:00.000Z");
}

export const packageSellAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: "package-sell",
  label: "Package sell (desk)",
  order: 21.5,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: "14-Package-Sell-2026.xlsx — PDF NAFTA PRICE & PACKAGES LIST (not EW)",
  headerAliases: {
    packageCode: "packageCode",
    packageName: "packageName",
    occupancy: "occupancy",
    sellPrice: "sellPrice",
    season: "season",
    roomType: "roomType",
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
    return {
      packageCode,
      packageName: cellString(raw.packageName) ?? packageCode,
      occupancy,
      sellPrice,
      season: cellString(raw.season),
      roomType: cellString(raw.roomType),
      desk,
      source: cellString(raw.source),
      extraBedAmount: cellNumber(raw.extraBedAmount),
    };
  },
  upsert: async (tx, row, dryRun) => {
    let plan = await tx.ratePlan.findFirst({ where: { code: row.packageCode } });
    if (dryRun) return plan ? "updated" : "created";
    if (!plan) {
      plan = await tx.ratePlan.create({
        data: {
          code: row.packageCode,
          name: row.packageName,
          type: "DERIVED",
          medicalFlag: true,
          pricePerNight: toDecimal(row.occupancy === 1 ? row.sellPrice : 0),
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
          ...(row.occupancy === 1 ? { pricePerNight: toDecimal(row.sellPrice) } : {}),
          ...(row.extraBedAmount != null ? { extraBedAmount: toDecimal(row.extraBedAmount) } : {}),
        },
      });
    }
    const effectiveFrom = seasonFrom(row.season);
    const note = [row.season, row.roomType, row.source].filter(Boolean).join(" | ") || null;
    const existing = await tx.ratePlanSellVersion.findFirst({
      where: {
        ratePlanId: plan.id,
        occupancy: row.occupancy,
        effectiveFrom,
        effectiveTo: null,
      },
    });
    if (existing) {
      await tx.ratePlanSellVersion.update({
        where: { id: existing.id },
        data: { sellPrice: toDecimal(row.sellPrice), note },
      });
      return "updated";
    }
    await tx.ratePlanSellVersion.create({
      data: {
        ratePlanId: plan.id,
        sellPrice: toDecimal(row.sellPrice),
        occupancy: row.occupancy,
        effectiveFrom,
        note,
      },
    });
    return "created";
  },
};
