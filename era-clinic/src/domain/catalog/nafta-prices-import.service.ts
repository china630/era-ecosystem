import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRequirements } from "@/domain/procedure/procedure-allocation.service";
import { recordCatalogPriceIfChanged } from "@/domain/catalog/catalog-price-history";
import {
  catalogKindBecomesProcedureType,
  inferServiceCatalogKind,
} from "@/domain/catalog/service-catalog-kind";
import {
  departmentFallbackLabel,
  ensureServiceDepartment,
} from "@/domain/catalog/service-department.service";
import { requestOrganizationId } from "@/lib/request-organization";

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
  const organizationId = requestOrganizationId();
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
    const rowAmount = row.amount != null ? Number(row.amount) : NaN;
    const hasRowAmount = Number.isFinite(rowAmount) && rowAmount > 0;
    // Commercial package amount stays 0 when included; listAmount keeps retail.
    const amount = packageIncluded ? 0 : Number(row.amount ?? 0);
    const listAmount = hasRowAmount ? rowAmount : null;
    const departmentLabel = row.department?.trim() || null;
    const dept = departmentLabel
      ? await ensureServiceDepartment(organizationId, departmentLabel)
      : null;
    const department = dept ? departmentFallbackLabel(dept) : null;
    const kind = inferServiceCatalogKind(code, department);

    await prisma.serviceCatalogCache.upsert({
      where: { organizationId_code: { organizationId, code } },
      create: {
        organizationId,
        code,
        description,
        descriptionAz,
        descriptionRu,
        descriptionEn,
        amount,
        listAmount,
        packageIncluded,
        department,
        departmentCode: dept?.code ?? null,
        kind,
        syncedAt: now,
      },
      update: {
        description,
        descriptionAz,
        descriptionRu,
        descriptionEn,
        amount,
        listAmount,
        packageIncluded,
        department,
        departmentCode: dept?.code ?? null,
        kind,
        syncedAt: now,
      },
    });
    await recordCatalogPriceIfChanged({
      organizationId,
      code,
      amount,
      listAmount,
      effectiveFrom: now,
    });
    catalogCount++;

    if (!catalogKindBecomesProcedureType(kind)) continue;

    const pt = await prisma.procedureType.upsert({
      where: { organizationId_code: { organizationId, code } },
      create: { organizationId, code, name: description, durationMin: 15 },
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
