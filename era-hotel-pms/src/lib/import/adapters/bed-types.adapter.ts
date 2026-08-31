import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellString, slugCode } from '@/lib/import/helpers';
import type { ImportAdapter } from '@/lib/import/types';

const rowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  systemType: z.string().optional().nullable(),
});

export const bedTypesAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'bed-types',
  label: 'Bed Type',
  order: 11,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: '04-Bed-Types.xlsx — EW Bed Type',
  headerAliases: {
    'Bed Type': 'code',
    'System Bed Type': 'name',
  },
  rowSchema,
  mapRow: (raw) => {
    const code = cellString(raw.code);
    const name = cellString(raw.name);
    return {
      code: code ? code.toUpperCase() : name ? slugCode(name) : null,
      name: name ?? code,
      systemType: name,
    };
  },
  upsert: async (tx, row, dryRun) => {
    const existing = await tx.bedType.findFirst({ where: { code: row.code } });
    if (dryRun) return existing ? 'updated' : 'created';
    await tx.bedType.upsert({
      where: { code: row.code } as never,
      create: {
        code: row.code,
        name: row.name,
        systemType: row.systemType ?? undefined,
      },
      update: {
        name: row.name,
        systemType: row.systemType ?? undefined,
      },
    });
    return existing ? 'updated' : 'created';
  },
};
