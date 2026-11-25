import type { PrismaClient } from "../../generated/client";

const SEED: Array<{
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  uomCode: string;
  hsCode?: string;
  classPath?: string;
  indicativePriceAzn?: number;
  sortOrder: number;
}> = [
  {
    code: "CEM-42.5",
    nameAz: "Portland sement 42.5",
    nameRu: "Портландцемент 42.5",
    nameEn: "Portland cement 42.5",
    uomCode: "T",
    classPath: "binders/cement",
    indicativePriceAzn: 120,
    sortOrder: 10,
  },
  {
    code: "REBAR-12",
    nameAz: "Armatur Ø12",
    nameRu: "Арматура Ø12",
    nameEn: "Rebar Ø12",
    uomCode: "T",
    classPath: "steel/rebar",
    indicativePriceAzn: 980,
    sortOrder: 20,
  },
  {
    code: "SAND-0-5",
    nameAz: "Quım 0–5 mm",
    nameRu: "Песок 0–5 мм",
    nameEn: "Sand 0–5 mm",
    uomCode: "M3",
    classPath: "aggregates/sand",
    indicativePriceAzn: 28,
    sortOrder: 30,
  },
];

export async function seedConstructionMaterials(prisma: PrismaClient): Promise<void> {
  for (const row of SEED) {
    await prisma.constructionMaterial.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
        uomCode: row.uomCode,
        hsCode: row.hsCode ?? null,
        classPath: row.classPath ?? null,
        indicativePriceAzn: row.indicativePriceAzn ?? null,
        sortOrder: row.sortOrder,
      },
      update: {
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
        uomCode: row.uomCode,
        hsCode: row.hsCode ?? null,
        classPath: row.classPath ?? null,
        indicativePriceAzn: row.indicativePriceAzn ?? null,
        sortOrder: row.sortOrder,
        isActive: true,
        deletedAt: null,
      },
    });
  }
}
