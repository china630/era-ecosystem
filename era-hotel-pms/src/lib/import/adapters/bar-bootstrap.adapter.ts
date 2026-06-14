import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { ensureBarBasePlan } from '@/lib/pricing/bar-bootstrap.service';
import type { ImportAdapter } from '@/lib/import/types';

const rowSchema = z.object({});

export const barBootstrapAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'bar-bootstrap',
  label: 'BAR bootstrap',
  order: 20.5,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: 'No file — run bootstrap',
  fileless: true,
  headerAliases: {},
  rowSchema,
  mapRow: () => ({}),
  upsert: async (tx, _row, dryRun) => {
    if (dryRun) {
      const existing = await tx.ratePlan.findFirst({ where: { code: 'BAR', type: 'BASE' } });
      return existing ? 'updated' : 'created';
    }
    const result = await ensureBarBasePlan(tx);
    return result.created ? 'created' : 'updated';
  },
};
