import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellBool, cellString, firstCellString } from '@/lib/import/helpers';
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
  order: 9,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: '09-Travel-Agencies.xlsx — EW Travel Agencies',
  headerAliases: {
    'Agent Code': 'code',
    'Agency Code': 'code',
    'Full Name': 'name',
    'Agency Name': 'name',
    'Agent Name': 'name',
    'Acc Code': 'voen',
    Phone: 'phone',
    Email: 'email',
    Passive: 'passiveFlag',
    'Is Deleted': 'deletedFlag',
  },
  rowSchema,
  mapRow: (raw) => {
    const code = firstCellString(raw, ['code', 'Agent Code', 'Agency Code']);
    const name = firstCellString(raw, ['name', 'Full Name', 'Agency Name', 'Agent Name']);
    if (!code && !name) return null;
    return {
      code: (code ?? name)?.toUpperCase(),
      name: name ?? code,
      voen: cellString(raw.voen) ?? firstCellString(raw, ['Acc Code', 'VOEN', 'VÖEN']),
      phone: cellString(raw.phone),
      email: cellString(raw.email),
      active: !(cellBool(raw.passiveFlag) || cellBool(raw.deletedFlag)),
    };
  },
  upsert: async (tx, row, dryRun) => {
    const existing = await tx.agency.findFirst({ where: { code: row.code } });
    if (dryRun) return existing ? 'updated' : 'created';
    await tx.agency.upsert({
      where: { code: row.code } as never,
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
