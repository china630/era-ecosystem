import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellNumber, cellString } from '@/lib/import/helpers';
import type { ImportAdapter } from '@/lib/import/types';

const rowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  baseQuota: z.number().int().positive(),
  adultCapacity: z.number().int().positive().optional(),
});

export const roomTypesAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'room-types',
  label: 'Room Types',
  order: 20,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: 'Room Types.xlsx',
  headerAliases: {
    'Room Type Code': 'code',
    'Room Type Name': 'name',
    'Max Adult': 'adultCapacity',
    'Room Count': 'baseQuota',
  },
  rowSchema,
  mapRow: (raw) => ({
    code: cellString(raw.code)?.toUpperCase(),
    name: cellString(raw.name),
    baseQuota: cellNumber(raw.baseQuota) ?? 1,
    adultCapacity: cellNumber(raw.adultCapacity) ?? 2,
  }),
  upsert: async (tx, row, dryRun) => {
    const existing = await tx.roomType.findUnique({ where: { code: row.code } });
    if (dryRun) return existing ? 'updated' : 'created';
    await tx.roomType.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        baseQuota: row.baseQuota,
        adultCapacity: row.adultCapacity ?? 2,
      },
      update: {
        name: row.name,
        baseQuota: row.baseQuota,
        adultCapacity: row.adultCapacity ?? 2,
      },
    });
    return existing ? 'updated' : 'created';
  },
};
