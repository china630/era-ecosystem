import { Prisma, SystemProductKind, TaxRateKind, UnitOfMeasureKind } from "@prisma/client";
import type { SeedContext } from "../_engine/upsert";

const SYSTEM_PRODUCTS = [
  {
    code: "__PSA_HOUR__",
    kind: SystemProductKind.SERVICE,
    defaultUomCode: "hour",
    defaultVatRateCode: "EDV_18",
    defaultPrice: new Prisma.Decimal(0),
    nameAz: "PSA saatı",
    nameRu: "PSA час",
    nameEn: "PSA hour",
    sortOrder: 0,
  },
  {
    code: "__DELIVERY__",
    kind: SystemProductKind.SERVICE,
    defaultUomCode: "pcs",
    defaultVatRateCode: "EDV_18",
    defaultPrice: new Prisma.Decimal(0),
    nameAz: "Çatdırılma",
    nameRu: "Доставка",
    nameEn: "Delivery",
    sortOrder: 1,
  },
] as const;

/**
 * Ensure FK cache rows exist for system product templates.
 * Full UoM / tax catalogs are owned by era-data-hub (Phase 2) — this is not a catalog seed.
 */
async function ensureFkCacheForSystemProducts(ctx: SeedContext): Promise<void> {
  const uoms = [
    {
      code: "pcs",
      kind: UnitOfMeasureKind.COUNT,
      nameAz: "əd",
      nameRu: "шт",
      nameEn: "pcs",
    },
    {
      code: "hour",
      kind: UnitOfMeasureKind.TIME,
      nameAz: "saat",
      nameRu: "час",
      nameEn: "hour",
    },
  ];
  for (const u of uoms) {
    await ctx.prisma.unitOfMeasure.upsert({
      where: { code: u.code },
      create: { ...u, isActive: true, sortOrder: 0 },
      update: {},
    });
  }
  await ctx.prisma.taxRate.upsert({
    where: { code: "EDV_18" },
    create: {
      code: "EDV_18",
      kind: TaxRateKind.VAT,
      percent: new Prisma.Decimal(18),
      effectiveFrom: new Date("2000-01-01T00:00:00.000Z"),
      nameAz: "ƏDV 18%",
      nameRu: "НДС 18%",
      nameEn: "VAT 18%",
      isActive: true,
      sortOrder: 0,
    },
    update: {},
  });
}

export async function seedSystemProductTemplates(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  await ensureFkCacheForSystemProducts(ctx);
  for (const row of SYSTEM_PRODUCTS) {
    await ctx.prisma.systemProductTemplate.upsert({
      where: { code: row.code },
      create: { ...row, isActive: true },
      update: { ...row, isActive: true },
    });
  }
}
