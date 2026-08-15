import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRequirements } from "@/domain/procedure/procedure-allocation.service";
import { inferServiceCatalogKind } from "@/domain/catalog/service-catalog-kind";

export type NaftaPriceRow = {
  code: string;
  description?: string;
  descriptionAz?: string;
  descriptionRu?: string;
  descriptionEn?: string;
  amount?: number;
  packageIncluded?: boolean;
  department?: string | null;
};

export function resolveNaftaDescription(row: NaftaPriceRow): string {
  return (
    row.description?.trim() ||
    row.descriptionAz?.trim() ||
    row.descriptionRu?.trim() ||
    row.descriptionEn?.trim() ||
    row.code
  );
}

export async function importNaftaPricesFromRows(rows: NaftaPriceRow[]) {
  const now = new Date();
  let catalogCount = 0;
  let typeCount = 0;

  for (const row of rows) {
    const code = row.code?.trim();
    if (!code) continue;

    const description = resolveNaftaDescription(row);
    const descriptionAz = row.descriptionAz?.trim() || null;
    const descriptionRu = row.descriptionRu?.trim() || null;
    let descriptionEn = row.descriptionEn?.trim() || null;
    if (!descriptionEn) {
      try {
        const enPath = path.join(
          process.cwd(),
          "prisma",
          "seed-data",
          "nafta",
          "procedure-en-names.json",
        );
        if (fs.existsSync(enPath)) {
          const enMap = JSON.parse(fs.readFileSync(enPath, "utf8")) as Record<
            string,
            string
          >;
          descriptionEn = enMap[code]?.trim() || null;
        }
      } catch {
        /* optional map */
      }
    }
    const packageIncluded = Boolean(row.packageIncluded);
    const amount = packageIncluded ? 0 : Number(row.amount ?? 0);
    const department = row.department?.trim() || null;
    const kind = inferServiceCatalogKind(code, department);

    await prisma.serviceCatalogCache.upsert({
      where: { code },
      create: {
        code,
        description,
        descriptionAz,
        descriptionRu,
        descriptionEn,
        amount,
        packageIncluded,
        department,
        kind,
        syncedAt: now,
      },
      update: {
        description,
        descriptionAz,
        descriptionRu,
        descriptionEn,
        amount,
        packageIncluded,
        department,
        kind,
        syncedAt: now,
      },
    });
    catalogCount++;

    const pt = await prisma.procedureType.upsert({
      where: { code },
      create: { code, name: description, durationMin: 15 },
      update: { name: description },
    });
    await ensureDefaultRequirements(pt.id);
    typeCount++;
  }

  return { catalogCount, typeCount };
}

export function defaultNaftaPricesPath(): string {
  return path.join(process.cwd(), "prisma", "seed-data", "nafta", "era-prices.json");
}

export async function importNaftaPricesFromFile(filePath?: string) {
  const target = filePath ?? defaultNaftaPricesPath();
  if (!fs.existsSync(target)) {
    return {
      skipped: true as const,
      message: `Nafta prices file not found: ${target}`,
    };
  }

  const raw = fs.readFileSync(target, "utf8");
  const rows = JSON.parse(raw) as NaftaPriceRow[];
  if (!Array.isArray(rows)) {
    throw new Error("era-prices.json must be a JSON array");
  }

  const { catalogCount, typeCount } = await importNaftaPricesFromRows(rows);
  return {
    skipped: false as const,
    catalogCount,
    typeCount,
    source: target,
  };
}
