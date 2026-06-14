import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellBool, cellString } from '@/lib/import/helpers';
import type { ImportAdapter } from '@/lib/import/types';

const rowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  voen: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export const agenciesAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'agencies',
  label: 'Travel Agencies',
  order: 30,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: 'Travel Agencies.xlsx',
  headerAliases: {
    'Agent Code': 'code',
    'Full Name': 'name',
    'Acc Code': 'voen',
    Phone: 'phone',
    Email: 'email',
    Passive: 'passiveFlag',
    'Is Deleted': 'deletedFlag',
  },
  rowSchema,
  mapRow: (raw) => ({
    code: cellString(raw.code)?.toUpperCase(),
    name: cellString(raw.name),
    voen: cellString(raw.voen),
    phone: cellString(raw.phone),
    email: cellString(raw.email),
    active: !(cellBool(raw.passiveFlag) || cellBool(raw.deletedFlag)),
  }),
  upsert: async (tx, row, dryRun) => {
    const existing = await tx.agency.findUnique({ where: { code: row.code } });
    if (dryRun) return existing ? 'updated' : 'created';
    await tx.agency.upsert({
      where: { code: row.code },
      create: {
        code: row.code,
        name: row.name,
        voen: row.voen ?? undefined,
        active: row.active ?? true,
      },
      update: {
        name: row.name,
        voen: row.voen ?? undefined,
        active: row.active ?? true,
      },
    });
    return existing ? 'updated' : 'created';
  },
};
