import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellString } from '@/lib/import/helpers';
import type { ImportAdapter } from '@/lib/import/types';
import { upsertElektraRateCode } from '@/lib/integration/elektraweb-sell-path';

const rowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  currency: z.string().optional().nullable(),
});

export const ratePlansAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'rate-plans',
  label: 'Rate Codes',
  order: 7,
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
  upsert: (tx, row, dryRun) => upsertElektraRateCode(tx, row, dryRun),
};
