import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellString } from '@/lib/import/helpers';
import { toDecimal } from '@/lib/decimal';
import type { ImportAdapter } from '@/lib/import/types';

const rowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  currency: z.string().optional().nullable(),
});

export const ratePlansAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'rate-plans',
  label: 'Rate Codes',
  order: 21,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: '07-Rate-Codes.xlsx — EW Rate Codes',
  headerAliases: {
    'Rate Code': 'code',
    'Rate Code Group': 'name',
    Currency: 'currency',
  },
  rowSchema,
  mapRow: (raw) => ({
    code: cellString(raw.code)?.toUpperCase(),
    name: cellString(raw.name) ?? cellString(raw.code),
    currency: cellString(raw.currency),
  }),
  upsert: async (tx, row, dryRun) => {
    const existing = await tx.ratePlan.findFirst({ where: { code: row.code } });
    if (dryRun) return existing ? 'updated' : 'created';
    await tx.ratePlan.upsert({
      where: { code: row.code } as never,
      create: {
        code: row.code,
        name: row.name,
        type: 'DERIVED',
        pricePerNight: toDecimal(0),
        active: true,
      },
      update: {
        name: row.name,
        active: true,
      },
    });
    return existing ? 'updated' : 'created';
  },
};
