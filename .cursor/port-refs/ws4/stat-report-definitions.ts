import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SeedContext } from "../_engine/upsert";
import { StatReportPeriodKind } from "@prisma/client";

export const STAT_REPORT_DEFINITIONS_CATALOG_PATH = join(
  __dirname,
  "..",
  "..",
  "catalog",
  "national",
  "stat-report-definitions.v1.json",
);

type CatalogDefinition = {
  code: string;
  name: string;
  periodKind: StatReportPeriodKind;
  version: number;
  mappingJson: Record<string, unknown>;
};

type CatalogFile = {
  definitions: CatalogDefinition[];
};

export async function seedStatReportDefinitions(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  const raw = JSON.parse(
    readFileSync(STAT_REPORT_DEFINITIONS_CATALOG_PATH, "utf-8"),
  ) as CatalogFile;
  for (const row of raw.definitions ?? []) {
    await ctx.prisma.statReportDefinition.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        periodKind: row.periodKind,
        version: row.version,
        mappingJson: row.mappingJson,
        isActive: true,
      },
      update: {
        name: row.name,
        periodKind: row.periodKind,
        version: row.version,
        mappingJson: row.mappingJson,
        isActive: true,
      },
    });
  }
  console.info(
    `[seed:national] stat report definitions upserted=${raw.definitions?.length ?? 0}`,
  );
}
