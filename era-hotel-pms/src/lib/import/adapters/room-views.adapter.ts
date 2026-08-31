import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellString, slugCode } from '@/lib/import/helpers';
import type { ImportAdapter } from '@/lib/import/types';

const rowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

export const roomViewsAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'room-views',
  label: 'Room Views',
  order: 12,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: '05-Room-Views.xlsx — EW Room Views',
  headerAliases: {
    View: 'name',
  },
  rowSchema,
  mapRow: (raw) => {
    const name = cellString(raw.name);
    if (!name) return { code: null, name: null };
    return { code: slugCode(name), name };
  },
  upsert: async (tx, row, dryRun) => {
    const existing = await tx.roomView.findFirst({ where: { code: row.code } });
    if (dryRun) return existing ? 'updated' : 'created';
    await tx.roomView.upsert({
      where: { code: row.code } as never,
      create: { code: row.code, name: row.name },
      update: { name: row.name },
    });
    return existing ? 'updated' : 'created';
  },
};
