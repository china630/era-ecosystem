import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma, StatReportPeriodKind } from "@erafinance/database";
import type { PrismaService } from "../prisma/prisma.service";

export const STAT_REPORT_DEFINITIONS_CATALOG_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "packages",
  "database",
  "prisma",
  "catalog",
  "national",
  "stat-report-definitions.v1.json",
);

type CatalogDefinition = {
  code: string;
  name: string;
  periodKind: StatReportPeriodKind;
  version: number;
  mappingJson: Prisma.InputJsonValue;
};

type CatalogFile = {
  definitions: CatalogDefinition[];
};

export function loadStatReportDefinitionsCatalog(): CatalogDefinition[] {
  const raw = JSON.parse(
    readFileSync(STAT_REPORT_DEFINITIONS_CATALOG_PATH, "utf-8"),
  ) as CatalogFile;
  return raw.definitions ?? [];
}

export async function upsertStatReportDefinitions(
  prisma: PrismaService,
): Promise<number> {
  const rows = loadStatReportDefinitionsCatalog();
  for (const row of rows) {
    const mappingJson = row.mappingJson as Prisma.InputJsonValue;
    await prisma.statReportDefinition.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        periodKind: row.periodKind,
        version: row.version,
        mappingJson,
        isActive: true,
      },
      update: {
        name: row.name,
        periodKind: row.periodKind,
        version: row.version,
        mappingJson,
        isActive: true,
      },
    });
  }
  return rows.length;
}
