import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellString } from '@/lib/import/helpers';
import type { ImportAdapter } from '@/lib/import/types';

const rowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  taxTag: z.string().optional().nullable(),
});

export const revenueCodesAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'revenue-codes',
  label: 'Revenue Code Definitions',
  order: 3,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: '03-Revenue-Codes.xlsx — EW Revenue Code Definitions',
  headerAliases: {
    Code: 'code',
    'Revenue Name': 'name',
    'Vat ': 'taxTag',
    Vat: 'taxTag',
    'Vat 1': 'taxTag',
  },
  rowSchema,
  mapRow: (raw) => ({
    code: cellString(raw.code)?.toUpperCase(),
    name: cellString(raw.name),
    taxTag: cellString(raw.taxTag),
  }),
  upsert: async (tx, row, dryRun) => {
    const existing = await tx.revenueCode.findFirst({ where: { code: row.code } });
    if (dryRun) return existing ? 'updated' : 'created';
    await tx.revenueCode.upsert({
      where: { code: row.code } as never,
      create: { code: row.code, name: row.name, taxTag: row.taxTag ?? undefined },
      update: { name: row.name, taxTag: row.taxTag ?? undefined },
    });
    return existing ? 'updated' : 'created';
  },
};
