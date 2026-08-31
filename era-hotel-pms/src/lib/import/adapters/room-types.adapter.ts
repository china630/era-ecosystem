import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellNumber, cellString } from '@/lib/import/helpers';
import type { ImportAdapter } from '@/lib/import/types';

const rowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  /** 0 is valid: EW BANQUET / function space has Room Count=0. */
  baseQuota: z.number().int().nonnegative(),
  adultCapacity: z.number().int().positive().optional(),
});

export const roomTypesAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'room-types',
  label: 'Room Types',
  order: 6,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: '06-Room-Types.xlsx — EW Room Types',
  headerAliases: {
    'Room Type Code': 'code',
    'Room Type Name': 'name',
    'Max Adult': 'adultCapacity',
    'Room Count': 'baseQuota',
  },
  rowSchema,
  mapRow: (raw) => {
    const code = cellString(raw.code)?.toUpperCase();
    const name = cellString(raw.name);
    // EW appends a totals footer (Id empty, Room Count = hotel inventory sum).
    if (!code && !name) return null;
    const quotaRaw = cellNumber(raw.baseQuota);
    const capRaw = cellNumber(raw.adultCapacity);
    return {
      code,
      name: name ?? code,
      // Missing quota → 1. Explicit 0 (BANQUET) stays 0 — do not coerce; `?? 1` would not run on 0 anyway.
      baseQuota: quotaRaw == null ? 1 : Math.max(0, Math.trunc(quotaRaw)),
      // EW footer / unused types often have Max Adult=0; same pattern as Rooms Max Bed=0.
      adultCapacity: capRaw != null && capRaw > 0 ? Math.trunc(capRaw) : 2,
    };
  },
  upsert: async (tx, row, dryRun) => {
    const existing = await tx.roomType.findFirst({ where: { code: row.code } });
    if (dryRun) return existing ? 'updated' : 'created';
    await tx.roomType.upsert({
      where: { code: row.code } as never,
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
