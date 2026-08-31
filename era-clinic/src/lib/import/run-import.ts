import { prisma } from "@/lib/prisma";
import { parseWorkbook } from '@/lib/import/excel';
import { mapHeaders } from "@/lib/import/helpers";
import type { ImportAdapter, ImportResult } from "@/lib/import/types";

export async function runImportRows<T>(
  adapter: ImportAdapter<T>,
  rows: Record<string, unknown>[],
  dryRun: boolean,
): Promise<ImportResult> {
  const result: ImportResult = {
    entity: adapter.entity,
    label: adapter.label,
    dryRun,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const excelRow = i + 2;
    try {
      const mapped = mapHeaders(rows[i], adapter.headerAliases);
      const transformed = adapter.mapRow(mapped);
      if (transformed == null) {
        result.skipped += 1;
        continue;
      }
      const row = adapter.rowSchema.parse(transformed);
      const outcome = await adapter.upsert(prisma, row, dryRun);
      if (outcome === 'created') result.created += 1;
      else if (outcome === 'updated') result.updated += 1;
      else result.skipped += 1;
    } catch (err) {
      result.errors.push({
        row: excelRow,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

export async function runImport<T>(
  adapter: ImportAdapter<T>,
  buffer: Buffer,
  dryRun: boolean,
): Promise<ImportResult> {
  const { rows } = parseWorkbook(buffer);
  return runImportRows(adapter, rows, dryRun);
}

export async function runImportBuffers<T>(
  adapter: ImportAdapter<T>,
  buffers: Buffer[],
  dryRun: boolean,
): Promise<ImportResult> {
  const rows: Record<string, unknown>[] = [];
  for (const buffer of buffers) {
    rows.push(...parseWorkbook(buffer).rows);
  }
  return runImportRows(adapter, rows, dryRun);
}

export async function runFilelessImport<T>(
  adapter: ImportAdapter<T>,
  dryRun: boolean,
): Promise<ImportResult> {
  const row = adapter.rowSchema.parse({});
  const outcome = await adapter.upsert(prisma, row, dryRun);
  return {
    entity: adapter.entity,
    label: adapter.label,
    dryRun,
    totalRows: 1,
    created: outcome === 'created' ? 1 : 0,
    updated: outcome === 'updated' ? 1 : 0,
    skipped: outcome === 'skipped' ? 1 : 0,
    errors: [],
  };
}
