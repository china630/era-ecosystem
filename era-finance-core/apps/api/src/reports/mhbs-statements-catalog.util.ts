import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PostingRole } from "@erafinance/database";

export type MhbsForm = "BALANCE" | "PL" | "CASH_FLOW" | "EQUITY_CHANGES" | "NOTES";

export type MhbsStatementLineDef = {
  form: MhbsForm;
  lineCode: string;
  labelAz: string;
  labelEn: string;
  nasPrefixes?: string[];
  offsetPrefixes?: string[];
  excludePrefixes?: string[];
  sign: "debit" | "credit";
  isTotal?: boolean;
  sumLineCodes?: string[];
  netOfLineCodes?: { credit: string[]; debit: string[] };
  section?: "OPERATING" | "INVESTING" | "FINANCING";
  postingRole?: PostingRole;
  postingRoles?: PostingRole[];
  agingBucket?: "0_30" | "31_90" | "90_plus";
};

type MhbsCatalogFile = {
  meta: { version: number; forms: MhbsForm[] };
  lines: MhbsStatementLineDef[];
};

let cachedCatalog: MhbsCatalogFile | null = null;

function catalogCandidatePaths(): string[] {
  const cwd = process.cwd();
  return [
    join(cwd, "packages", "database", "prisma", "catalog", "national", "mhbs-statement-lines.v1.json"),
    join(cwd, "..", "packages", "database", "prisma", "catalog", "national", "mhbs-statement-lines.v1.json"),
    join(
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
      "mhbs-statement-lines.v1.json",
    ),
  ];
}

export async function loadMhbsStatementCatalog(): Promise<MhbsCatalogFile> {
  if (cachedCatalog) return cachedCatalog;
  for (const path of catalogCandidatePaths()) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(await readFile(path, "utf8")) as MhbsCatalogFile;
      if (Array.isArray(raw.lines) && raw.lines.length > 0) {
        cachedCatalog = raw;
        return raw;
      }
    } catch {
      // try next path
    }
  }
  throw new Error("MHBS statement line catalog not found (mhbs-statement-lines.v1.json)");
}

export function linesForForm(
  catalog: MhbsCatalogFile,
  form: MhbsForm,
): MhbsStatementLineDef[] {
  return catalog.lines.filter((l) => l.form === form);
}
