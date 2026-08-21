import { z } from 'zod';
import { satelliteOrganizationId } from '@era/satellite-kit';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { cellNumber, cellString, parseDateCell } from '@/lib/import/helpers';
import { toDecimal } from '@/lib/decimal';
import type { ImportAdapter } from '@/lib/import/types';

const rowSchema = z.object({
  externalRef: z.string().min(1),
  reservationExternalRef: z.string().min(1),
  revenueCode: z.string().min(1),
  amount: z.number(),
  description: z.string().min(1),
  businessDate: z.date(),
});

export const foliosAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'folios',
  label: 'Folios',
  order: 60,
  permission: PERMISSIONS.FOLIO_CHARGE,
  templateHint: 'Folios.xlsx',
  headerAliases: {
    Id: 'externalRef',
    'Res Id': 'reservationExternalRef',
    'Revenue Code': 'revenueCode',
    Income: 'amount',
    'Local Amount': 'localAmount',
    Date: 'businessDate',
    'Guest Name': 'guestName',
    'Doc Note': 'docNote',
    Notes: 'notes',
  },
  rowSchema,
  mapRow: (raw) => {
    const amount = cellNumber(raw.amount) ?? cellNumber(raw.localAmount);
    if (amount == null) throw new Error('Income or Local Amount is required');
    const businessDate = parseDateCell(raw.businessDate) ?? new Date();
    const guestName = cellString(raw.guestName);
    const docNote = cellString(raw.docNote);
    const notes = cellString(raw.notes);
    return {
      externalRef: cellString(raw.externalRef),
      reservationExternalRef: cellString(raw.reservationExternalRef),
      revenueCode: cellString(raw.revenueCode)?.toUpperCase(),
      amount,
      description: [guestName, docNote, notes].filter(Boolean).join(' — ') || 'Imported folio line',
      businessDate,
    };
  },
  upsert: async (tx, row, dryRun) => {
    const reservation = await tx.reservation.findFirst({
      where: { externalRef: row.reservationExternalRef },
      include: { folios: true },
    });
    if (!reservation) {
      throw new Error(`Reservation not found for Res Id ${row.reservationExternalRef}`);
    }

    const revenue = await tx.revenueCode.findFirst({
      where: {
        OR: [
          { code: row.revenueCode },
          { name: { equals: row.revenueCode, mode: 'insensitive' } },
        ],
      },
    });
    if (!revenue) throw new Error(`Revenue code not found: ${row.revenueCode}`);

    let folio = reservation.folios.find((f) => f.type === 'GUEST' && f.status === 'OPEN');
    if (!folio && !dryRun) {
      folio = await tx.folio.create({
        data: {
          organizationId: satelliteOrganizationId(),
          reservationId: reservation.id,
          type: 'GUEST',
          status: 'OPEN',
        },
      });
    } else if (!folio && dryRun) {
      folio = reservation.folios[0] ?? { id: 'dry-run-folio' };
    }
    if (!folio) throw new Error('Could not resolve folio for reservation');

    const existing = await tx.folioCharge.findFirst({ where: { externalRef: row.externalRef } });
    const data = {
      externalRef: row.externalRef,
      folioId: folio.id,
      revenueCodeId: revenue.id,
      amount: toDecimal(row.amount),
      qty: 1,
      description: row.description,
      businessDate: row.businessDate,
    };

    if (dryRun) return existing ? 'updated' : 'created';

    await tx.folioCharge.upsert({
      where: { externalRef: row.externalRef } as never,
      create: data,
      update: {
        revenueCodeId: data.revenueCodeId,
        amount: data.amount,
        description: data.description,
        businessDate: data.businessDate,
      },
    });

    return existing ? 'updated' : 'created';
  },
};
